Usher
=====

Usher enables simple, dependency based compositions of activities and decisions for AWS Simple Workflows.

## Activity Conventions

Activities are defined in a named group of activities tied to a single `taskList`. Each activity has a name and a version where the version is a valid [Semver](http://semver.org) version or range. Activities have access to their input and are expected to return a success or failure status. If successful, an optional payload can be provided.

## Workflow (Decider) Conventions

Workflows are named units representing an orchestrated set of business tasks (ie: ship order, register user, run report). Workflows are tied to a specific SWF domain. For each named workflow, you can defined versions of the workflow following the [semver](http://semver.org) spec. Versioned workflows are composed of tasks where every task is named and can optionally have a list of dependencies of other tasks. Tasks execute as soon as their dependencies are met.

### Tasks

+ Activity - Represents a SWF Activity in the workflow. When this task executes, the decider will schedule the given activity to run with SWF.
+ Decision - Represents a binary decision that executed immediately within the workflow. Deciders can make their decisions based on their input. Like all tasks, the input of the task is a composition of it's dependencies output.
+ Child - Represents a SWF child workflow. When this task executes, the specified child workflow will execute. The success or failure of this task will mimic that of the child workflow.
+ Loop - Allows for executing fragment workflows repeatedly for a set of input.
+ Transform - A transform task can take it's input, manipulate it in some way, then output it for it's dependents to consume later. Transform tasks, like Decision tasks, execute within the context of the current decision task.
+ Terminate - A terminate task will end the workflow. Termination tasks are only needed when you compose a flow that branches and can have nodes that will never execute.

### Execution Details

Given the following activity and workflow definition:

``` javascript
var usher = require('usher');

// Define activities used by workflow
var activities = usher
  .activities('linear-activities', 'my-domain-name')
    .activity('activity1', '1.0.0', function (task) {
      task.success({ "key1": "value 1" });
    })
    .activity('activity2', '1.0.0', function (task) {
      task.success({ "key2": "value 2" });
    })
    .activity('activity3', '1.0.0', function (task) {
      task.success({ "key3": "value 3" });
    })
    .activity('activity4', '1.0.0', function (task) {
      task.success({ "key4": "old value 4" });
    })
    .activity('activity4', '1.1.0', function (task) {
      task.success({ "key4": "value 4" });
    });

// Define the workflow
var workflow = usher
  .workflow('linear-workflow', 'my-domain-name')
    .version('1.0.0')
      .activity('activity1')
      .activity('activity2', ['activity1'])
      .activity('activity3', ['activity2'])
      .activity('activity4', ['activity3'], { version: '1.1.0' });

// Start listening
activities.start();
workflow.start();
```

For each execution of the workflow, Usher will make decisions as outlined below.

#### The Decisions

The following outlines the details of the decisions the workflow will schedule with SWF for each workflow execution. For more information on this format see the SWF API for [RespondDecisionTaskCompleted](http://docs.aws.amazon.com/amazonswf/latest/apireference/API_RespondDecisionTaskCompleted.html)

+ `activity1`
``` json
"scheduleActivityTaskDecisionAttributes": {
  "activityId": "activity1",
  "activityType": {
    "name": "activity1",
    "version": "1.0"
  },
  "heartbeatTimeout": "60",
  "input": "[ \"_input\": \"<workflow input>\" ]",
  "scheduleToCloseTimeout": "360",
  "scheduleToStartTimeout": "60",
  "startToCloseTimeout": "300",
  "taskList": {
    "name": "activity1-tasklist"
  }
}
```

+ `activity2`
``` json
"scheduleActivityTaskDecisionAttributes": {
  "activityId": "activity2",
  "activityType": {
    "name": "activity2",
    "version": "1.0"
  },
  "heartbeatTimeout": "60",
  "input": "[ \"_input\": \"<workflow input>\", \"activity1\": \"{ \"key1\": \"value 1\" }\" ]",
  "scheduleToCloseTimeout": "360",
  "scheduleToStartTimeout": "60",
  "startToCloseTimeout": "300",
  "taskList": {
    "name": "activity2-tasklist"
  }
}
```

+ `activity3`
``` json
"scheduleActivityTaskDecisionAttributes": {
  "activityId": "activity3",
  "activityType": {
    "name": "activity3",
    "version": "1.0"
  },
  "heartbeatTimeout": "60",
  "input": "[ \"_input\": \"<workflow input>\", \"activity2\": \"{ \"key2\": \"value 2\" }\" ]",
  "scheduleToCloseTimeout": "360",
  "scheduleToStartTimeout": "60",
  "startToCloseTimeout": "300",
  "taskList": {
    "name": "activity3-tasklist"
  }
}
```

+ `activity4`
``` json
"scheduleActivityTaskDecisionAttributes": {
  "activityId": "activity4",
  "activityType": {
    "name": "activity4",
    "version": "1.0"
  },
  "heartbeatTimeout": "60",
  "input": "[ \"_input\": \"<workflow input>\", \"activity3\": \"{ \"key3\": \"value 3\" }\" ]",
  "scheduleToCloseTimeout": "360",
  "scheduleToStartTimeout": "60",
  "startToCloseTimeout": "300",
  "taskList": {
    "name": "activity4-tasklist"
  }
}
```

#### Results

This is a summary of the input and output for each activity and the final result of the workflow execution.

1. `activity1`
  + input: `{ "_input": "<workflow input>" }`
  + output: `{ "key1": "value 1" }`
2. `activity2`
  + input: `{ "_input": "<workflow input>", "activity1": { "key1": "value 1" } }`
  + output: `{ "key2": "value 2" }`
3. `activity3`
  + input: `{ "_input": "<workflow input>", "activity2": { "key2": "value 2" } }`
  + output: `{ "key3": "value 3" }`
4. `activity4`
  + input: `{ "_input": "<workflow input>", "activity3": { "key3": "value 3" } }`
  + output: `{ "key4": "value 4" }`
5. Workflow Completion
  + result:
    ``` json
    {
      "activity1": { "key1": "value 1" },
      "activity2": { "key2": "value 2" },
      "activity3": { "key3": "value 3" },
      "activity4": { "key4": "value 4" }
    }
    ```
