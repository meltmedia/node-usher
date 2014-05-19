var usher = require('usher');

/**
 *          activity1
 *              |
 *          activity2
 *              |
 *          activity3
 *              |
 *          activity4
 */

// Define workflow
var linearWorkflow = usher.workflow('linear-workflow', 'your-domain-name')
  // activity1 is the entry point
  .activity('activity1')

  // activity2 will execute once activity1 is complete
  .activity('activity2', ['activity1'])

  // activity3 will execute once activity2 is complete
  .activity('activity3', ['activity2'])

  // activity4 will execute once activity3 is complete
  .activity('activity4', ['activity3']);

// Start polling for decision tasks
linearWorkflow.start();
