const express = require('express');
const path = require('path');
const app = express();
const mysql = require('mysql');
const http = require('http');
const https = require('https');
const fs = require('fs');
var async = require("async");

/*
// Certificate
const privateKey = fs.readFileSync('/etc/letsencrypt/live/twitchmap.fr/privkey.pem', 'utf8');
const certificate = fs.readFileSync('/etc/letsencrypt/live/twitchmap.fr/cert.pem', 'utf8');
const ca = fs.readFileSync('/etc/letsencrypt/live/twitchmap.fr/chain.pem', 'utf8');

const credentials = {
	key: privateKey,
	cert: certificate,
	ca: ca
};
*/
app.use(express.static(path.join(__dirname, 'build')));

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

var con = mysql.createConnection({
	  host: "localhost",
	  user: "root",
	  password: "",
	  database: "datatwitch"
	});

async function deleteOldRows(){
	return new Promise((resolve, reject) => {
		/*con.query("DELETE FROM users WHERE date < (NOW() - INTERVAL 24 HOUR)", function (err, result) {
			con.query("DELETE t1 FROM `clusters` t1 LEFT JOIN `users` t2 ON t1.id = t2.cluster_id WHERE t2.cluster_id IS NULL", function (err, result) {resolve();});
		});*/
		
		con.query("DELETE FROM users ", function (err, result) {
			con.query("DELETE FROM clusters", function (err, result) {resolve();});
		});
	});
}

async function getTop(nb){
	return new Promise((resolve, reject) => {
		const options = {
			hostname: 'api.twitch.tv',
			path: '/helix/streams?language=fr&first='+nb,
			headers: {
				'Authorization': 'Bearer bk20q7lgqa28fgzjk9guby0wrub6l6',
				'Client-Id': 'gp762nuuoqcoxypju8c569th9wz7q5'
			}
		}
		https.get(options, (resp) => {
		  let data = '';

		  // Un morceau de réponse est reçu
		  resp.on('data', (chunk) => {
			data += chunk;
		  });

		  // La réponse complète à été reçue. On affiche le résultat.
		  resp.on('end', () => {
			result = JSON.parse(data);
			var streamers = [];
			for (let i = 0; i < result.data.length; i++) {				
				streamers.push(result.data[i].user_login);
				//result.data[i].thumbnail_url
			}
			resolve(streamers);
		  });
		}).on("error", (err) => {
		  console.log("Error: " + err.message);
		});
	});
}

async function queryCluster(){
	return new Promise((resolve, reject) => {
		var cluster = {};
		con.query("SELECT nom, id FROM `clusters`", function (err, result) {
			if (err) throw err;
			for (let i = 0; i < result.length; i++) {				
				cluster[result[i].nom] = result[i].id;
			}
		});
	});
}

async function queryNb(){
	return new Promise((resolve, reject) => {
		con.query("SELECT count(*) as nb FROM `users`", function (err, result) {
			if (err) throw err;
			resolve(result[0].nb);
		});
	});
}
	
async function insertDataToDB(nom){
	console.log("insertion "+nom+"...");
	return new Promise((resolve, reject) => {
		var cluster = {};
		con.query("SELECT nom, id FROM `clusters`", function (err, result) {
			if (err) throw err;
			for (let i = 0; i < result.length; i++) {
				cluster[result[i].nom] = result[i].id;
			}
			
			var valuesCluster = [[stringToColour(nom),nom,nom]];
			con.query("INSERT IGNORE INTO `clusters`(`color`, `label`, `nom`) VALUES ?", [valuesCluster], function (err, result) {
				if (err) throw err;
				
				if(result != undefined){
					if(result.insertId != undefined){
						if(result.insertId != 0){
							cluster[nom] = result.insertId;
						}
					}
				}
				https.get('https://tmi.twitch.tv/group/user/'+nom+'/chatters', (resp) => {
				  let data = '';
				  // A chunk of data has been received.
				  resp.on('data', (chunk) => {
					data += chunk;
				  });
				  // The whole response has been received. Print out the result.
				  resp.on('end', () => {
					  
					var dataParsed = JSON.parse(data)
					var values = []
					for (let i = 0; i < dataParsed.chatters.viewers.length; i++) {
						var viewer = dataParsed.chatters.viewers[i];
						values.push([viewer,nom,cluster[nom], viewer+nom])
					}
					con.query("INSERT IGNORE INTO `users`(`viewer`, `streamer`, `cluster_id`,`id`) VALUES ?", [values], function (err, result) {
						if (err) throw err;				
						resolve();
					});
				  });
				}).on("error", (err) => {
				  console.log("Error: " + err.message);
				});
			});			
		});
	});
}

async function writeDataToFile() {
	var len = await queryNb();
	return new Promise((resolve, reject) => {
		const user = {
			nodes: [],
			edges: [],
			clusters: [],
			tags: [{ "key": "Streamer", "image": "tool.svg" },{ "key": "Viewer", "image": "field.svg" }]
		}
		
		
		con.query("SELECT * FROM `clusters`", function (err, result) {
			for (let i = 0; i < result.length; i++) {
				user.clusters.push({ "key": result[i].id, "color": result[i].color, "clusterLabel": result[i].label });
			}
			console.log("clusters created");
		});
		
		
		var already=[];
		//streamer node
		con.query("SELECT *, count(viewer) as nb FROM `users` GROUP BY streamer", function (err, result) {
			if (err) throw err;
			for (let i = 0; i < result.length; i++) {
				if(already.indexOf(result[i].streamer) == -1){
					user.nodes.push({
						"key": result[i].streamer,
						"label": result[i].streamer,
						"tag": "Streamer",
						"URL": "",
						"cluster": result[i].cluster_id,
						"x": Math.random()*100,
						"y": Math.random()*100,
						"score":  result[i].nb
					});
					already.push(result[i].streamer);
				}
			}	
			console.log("streamers node created");			
		});
		
		
		//user node & edges
		con.query("SELECT viewer, streamer, cluster_id, color FROM `users` LEFT JOIN clusters ON users.cluster_id = clusters.id", function (err, result) {
			if (err) throw err;	
			async.forEachOf(result, (value, key, callback) => {
				
				user.nodes.push({
					"key": value.viewer,
					"label": value.viewer,
					"tag": "Viewer",
					"URL": "",
					"cluster": value.cluster_id,
					"x":  Math.random()*100,
					"y":  Math.random()*100,
					"score":  1
				});
				already.push(value.viewer);
				
				user.edges.push([value.viewer,value.streamer, value.color]);	
				callback();
			}, err => {
				if (err) console.error(err.message);
				
				console.log("writing to file...");
				const userJSON = JSON.stringify(user);
				fs.writeFile(path.join(__dirname, 'build', 'dataset.json'), userJSON, function(err) {
					if(err) {
						return console.log(err);
					}		
					resolve();
				}); 
			});
		});
	});
}


var stringToColour = function(str) {
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  var colour = '#';
  for (var i = 0; i < 3; i++) {
    var value = (hash >> (i * 8)) & 0xFF;
    colour += ('00' + value.toString(16)).substr(-2);
  }
  return colour;
}
function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

(async function my_func() {
    await deleteOldRows();
	console.log("old rows deleted!");
	var arr = await getTop(20);
	const results = await Promise.all(arr.map(arr => {
		return insertDataToDB(arr);
	}));
	await writeDataToFile();
	console.log("file updated!");
    setTimeout( my_func, 300000 );
})();



// Starting both http & https servers
/*const httpServer = http.createServer(app);
const httpsServer = https.createServer(credentials, app);*/



app.listen(9000, () => {
	console.log('HTTP Server running on port 9000');
});
/*httpsServer.listen(443, () => {
	console.log('HTTPS Server running on port 443');
});*/