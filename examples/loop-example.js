var usher = require('usher'),
    _ = require('lodash');

/**
 *          activity1
 *              |
 *            loop1 -> activity1 -> activity2 <-
 *              |
 *          activity3
 */

// Define fragment used for the loop
var loopBranch = usher.fragment('loop-fragment')
  .activity('activity1')
  .activity('activity2', ['activity1']);


// Define workflow
var loopWorkflow = usher.workflow('loop-workflow', 'your-domain-name');

loopWorkflow
  .version('1.0.0')
    // activity1 is the entry point
    .activity('activity1')

    // child1 workflow will execute once activity1 is complete
    .loop('loop1', ['activity1'], loopBranch, function (input) {
      return _.map(input.activity1, function (item) { return item.id; });
    })

    // activity2 will execute once child1 workflow is complete
    .activity('activity3', ['loop1']);


// Start polling for decision tasks
loopWorkflow.start();
