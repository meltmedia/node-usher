'use strict';

var usher = require('usher');

/**
 *          activity1
 *              |
 *            child1 -> activity1 -> activity2 -> activity3 -> activity4
 *              |
 *          activity2
 */

// Define workflow
var parentWorkflow = usher.workflow('parent-workflow', 'your-domain-name')
  // activity1 is the entry point
  .activity('activity1')

  // child1 workflow will execute once activity1 is complete
  .child('child1', ['activity1'], 'child-workflow', '1.0', {
    tagList: function (input) {
      return [
        'source:' + input.activity1.id // Assuming the output of 'activity1' had a property named 'id'
      ];
    }
  })

  // activity2 will execute once child1 workflow is complete
  .activity('activity2', ['child1']);


// Define child workflow
var childWorkflow = usher.workflow('child-workflow', 'your-domain-name')
  // activity1 is the entry point
  .activity('activity1')

  // activity2 will execute once activity1 is complete
  .activity('activity2', ['activity1'])

  // activity3 will execute once activity2 is complete
  .activity('activity3', ['activity2'])

  // activity4 will execute once activity3 is complete
  .activity('activity4', ['activity3']);

// Start polling for decision tasks
parentWorkflow.start();
childWorkflow.start();
