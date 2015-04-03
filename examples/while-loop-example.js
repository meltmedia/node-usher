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
var loopWorkflow = usher.workflow('while-loop-workflow', 'your-domain-name');

loopWorkflow
  .version('1.0.0')
    // activity1 is the entry point
    .activity('activity1')

    // loop through the fragment workflow until the done condition is met
    .whileLoop('while1', ['activity1'], loopBranch, function (results) {
      return results.activity2.length <= 0;
    })

    .while('while1', ['activity1'], loopBranch, )


    // activity2 will execute once child1 workflow is complete
    .activity('activity3', ['while1']);


// Start polling for decision tasks
loopWorkflow.start();
