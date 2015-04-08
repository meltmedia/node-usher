'use strict';

var usher = require('../../index');

module.exports = {
  start: start,
  stop: stop
};

var whileCount1 = 0,
    whileCount2 = 0,
    whileMaxCount = 2;

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
  })
  .activity('while-activity1', '*', function (task) {
    whileCount1++;
    task.success({
      done: whileCount1 > whileMaxCount,
      _state: task.input._input._state
    });
  })
  .activity('while-activity2', '*', function (task) {
    whileCount2++;
    var items = whileCount2 > whileMaxCount ? [] : ['item1', 'item2', 'item3'];
    task.success(items);
  })
  .activity('variable-activity1', '*', function (task) {
    task.success(task.input._variables);
  })
  .activity('variable-activity2', '*', function (task) {
    task.success(task.input._variables);
  })
  .activity('variable-activity3', '*', function (task) {
    task.success(task.input._variables);
  });

function start() {
  poller.start();
}

function stop() {
  if (poller) {
    poller.stop();
  }
}
