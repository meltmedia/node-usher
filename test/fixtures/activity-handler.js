'use strict';

var winston = require('winston'),
    swf = require('aws-swf'),
    AWS = require('aws-sdk');

var poller;


module.exports = {
  start: start,
  stop: stop
};


function start() {
console.log('START ACTIVITY HANDLER');
  poller = new swf.ActivityPoller({
      domain: '_test_workflow_',
      taskList: { name: 'test-workflow-activity-tasklist' },
      identity: 'test-activity-poller'
    },
    new AWS.SimpleWorkflow());


  // Handle any activity task handed to us
  poller.on('activityTask', handleActivityTask);

  poller.start();

  return poller;
}

function stop() {
console.log('STOP ACTIVITY HANDLER');

  if (poller) {
    poller.stop();
  }
}

function handleActivityTask(task) {
  try {

    switch (task.config.activityType.name) {

    case 'activity1':
      task.respondCompleted({ activity1: 'Activity 1 output' });
      break;

    case 'activity2':
      task.respondCompleted({ activity2: 'Activity 2 output' });
      break;

    case 'activity3':
      task.respondCompleted({ activity3: 'Activity 3 output' });
      break;

    case 'activity4':
      task.respondCompleted({ activity4: 'Activity 4 output' });
      break;

    case 'activity5':
      task.respondCompleted({ activity5: 'Activity 5 output' });
      break;

    case 'activity6':
      task.respondCompleted({ activity6: 'Activity 6 output' });
      break;

    default:
      task.respondFailed('failed', 'failed');

    }

  } catch (err) {
    winston.log('error', 'Error occured processing activity task: %s', err, {});
  }
};
