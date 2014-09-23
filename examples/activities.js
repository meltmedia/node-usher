var usher = require('usher');

// Define activities
var activities = usher.activities('activities', 'your-domain-name', { taskList: 'activity-tasklist' })

  // Activity 1 - Success
  .activity('activity1', '*', function (task) {
    task.success({
      activity1: 'Activity 1 output',
      passthrough: task.input
    });
  })

  // Activity 2 - Success
  .activity('activity2', '*', function (task) {
    task.success({ activity2: 'Activity 2 output' });
  })

  // Activity 3 - Success
  .activity('activity3', '*', function (task) {
    task.success({ activity3: 'Activity 3 output' });
  })

  // Activity 4 - Failure
  .activity('activity4', '*', function (task) {
    task.failure('ActivityFailed', new Error('Why it failed'));
  });

// Start polling for decision tasks
activities.start();
