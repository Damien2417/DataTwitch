import { useSigma } from "react-sigma-v2";
import { FC, useEffect } from "react";
import { keyBy, omit } from "lodash";

import { Dataset, FiltersState } from "../types";

const GraphDataController: FC<{ dataset: Dataset; filters: FiltersState }> = ({ dataset, filters, children }) => {
  const sigma = useSigma();
  const graph = sigma.getGraph();

  /**
   * Feed graphology with the new dataset:
   */
  useEffect(() => {
    if (!graph || !dataset) return;

    const clusters = keyBy(dataset.clusters, "key");
    const tags = keyBy(dataset.tags, "key");

    dataset.nodes.forEach((node) =>{
		try{
		  graph.addNode(node.key, {
			...node,
			...omit(clusters[node.cluster], "key"),
			image: `${process.env.PUBLIC_URL}/images/${tags[node.tag].image}`,
		  })
		}
		catch(error){}
	}
    );
    dataset.edges.forEach(([source, target, color]) => graph.addEdge(source, target, { size: 0.01, color: color }));

    // Use degrees as node sizes:
    const scores = graph.nodes().map((node) => graph.getNodeAttribute(node, "score"));
	scores.sort((a, b) => a - b);
    const minDegree = scores[0];
	const maxDegree = scores[scores.length - 1];

    const MIN_NODE_SIZE = 1;
    const MAX_NODE_SIZE = 30;
    graph.forEachNode((node) =>
      graph.setNodeAttribute(
        node,
        "size",
        ((graph.getNodeAttribute(node, "score") - minDegree) / (maxDegree - minDegree)) *
          (MAX_NODE_SIZE - MIN_NODE_SIZE) +
          MIN_NODE_SIZE,
      ),
    );

    return () => graph.clear();
  }, [graph, dataset]);

  /**
   * Apply filters to graphology:
   */
  useEffect(() => {
    const { clusters, tags } = filters;
    graph.forEachNode((node, { cluster, tag }) =>
      graph.setNodeAttribute(node, "hidden", !clusters[cluster] || !tags[tag]),
    );
  }, [graph, filters]);

  return <>{children}</>;
};

export default GraphDataController;
