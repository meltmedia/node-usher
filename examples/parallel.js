var usher = require('usher');

/**
 *          activity1
 *              |
 *          activity2
 *         /    |    \
 * activity3 activity4 activity5
 *         \    |    /
 *          activity6
 */


// Define workflow
var parallelWorkflow = usher.workflow('linear-workflow', 'your-domain-name');

parallelWorkflow
  .version('1.0.0')
    // activity1 is the entry point
    .activity('activity1')

    // activity2 will execute once activity1 is complete
    .activity('activity2', ['activity1'])

    // activity3 will execute once activity2 is complete
    .activity('activity3', ['activity2'])

    // activity4 will execute once activity2 is complete
    .activity('activity4', ['activity2'])

    // activity4 will execute once activity2 is complete
    .activity('activity5', ['activity2'])

    // activity4 will execute once activity3, activity4, and activity5 are complete
    .activity('activity6', ['activity3', 'activity4', 'activity5']);


// Start polling for decision tasks
parallelWorkflow.start();
