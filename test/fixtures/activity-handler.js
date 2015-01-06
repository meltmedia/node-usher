'use strict';

var usher = require('../../index');

module.exports = {
  start: start,
  stop: stop
};


var poller = usher.activities('test', '_test_workflow_', { taskList: 'test-workflow-activity-tasklist' })
  .activity('activity1', '*', function (task) {
    task.success({ activity1: 'Activity 1 output', input: task.input });
  })
  .activity('activity2', '*', function (task) {
    task.success({ activity2: 'Activity 2 output' });
  })
  .activity('activity3', '*', function (task) {
    task.success({ activity3: 'Activity 3 output' });
  })
  .activity('activity4', '*', function (task) {
    task.success({ activity4: 'Activity 4 output' });
  })
  .activity('activity5', '*', function (task) {
    task.success({ activity5: 'Activity 5 output' });
  })
  .activity('activity6', '*', function (task) {
    task.success({ activity6: 'Activity 6 output' });
  })
  .activity('failure1', '*', function (task) {
    task.failed('Failure', new Error(), false);
  })
  .activity('timeout1', '*', function () {
    // do nothing, let us timeout
  });

function start() {
  poller.start();
}

function stop() {
  if (poller) {
    poller.stop();
  }
}
