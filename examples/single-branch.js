var usher = require('usher');

/**
 *           activity1
 *               |
 *           activity2
 *          /         \
 * decision1           decision2
 *     |                   |
 * activity3           activity4
 *     |                   |
 *   term1               term2
 *
 */


// Define workflow
var branchWorkflow = usher.workflow('branch-workflow', 'your-domain-name')
  // activity1 is the entry point
  .activity('activity1')

  // activity2 will execute once activity1 is complete
  .activity('activity2', ['activity1'])

  // decision1 will execute once activity2 is complete
  .decision('decision1', ['activity2'], function (input) {
    return true;
  })

  // activity3 will execute if decision1 is true
  .activity('activity3', ['decision1'])

  // workflow will terminate once activity3 is complete
  .terminate('term1', ['activity3'])

  // decision2 will execute once activity2 is complete
  .decision('decision2', ['activity2'], function (input) {
    return false;
  })

  // activity4 will execute if decision1 is true
  .activity('activity4', ['decision2'])

  // workflow will terminate once activity4 is complete
  .terminate('term2', ['activity4']);

// Start polling for decision tasks
branchWorkflow.start();
