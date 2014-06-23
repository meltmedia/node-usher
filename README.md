Usher
=====

This libraries goal is to enable simple, dependency based compositions of activities and decisions for AWS Simple Workflows.

In the name of simplicity, this library has strong opinions on convention, with the ability to configure and override some of these conventions.

Note: This library is used to implement [Deciders](http://docs.aws.amazon.com/amazonswf/latest/developerguide/swf-dev-actors.html#swf-dev-actors-deciders) for AWS [Simple Workflow Service](http://aws.amazon.com/swf/). If you do not know what these are, this library is not for you (yet).

## Conventions

All actors in the system are considered tasks in the workflow. Every task is named and can optionally have a list of dependencies of other tasks. Tasks execute as soon as their dependencies are met.

### Tasks

+ Activity - Represents a SWF Activity in the workflow. When this task executes, the decider will schedule the given activity to run with SWF.
+ Decision - Represents a binary decision that executed immediately within the workflow. Deciders can make their decisions based on their input. Like all tasks, the input of the task is a composition of it's dependencies output.
+ Child - Represents a SWF child workflow. When this task executes, the specified child workflow will execute. The success or failure of this task will mimic that of the child workflow.
+ Loop - Allows for executing fragment workflows repeatedly for a set of input.
+ Transform - A transform task can take it's input, manipulate it in some way, then output it for it's dependents to consume later. Transform tasks, like Decision tasks, execute within the context of the current decision task.
+ Terminate - A terminate task will end the workflow. Termination tasks are only needed when you compose a flow that branches and can have nodes that will never execute.

## Install

```
npm install usher --save
```

## Example

### Linear Workflow

This is a simple example of 4 activities executing in sequential order.

Note: This example makes assumptions that you have some prior experience with SWF, in particular how decision tasks are scheduled.

This example does not cover the details of the activities themselves, or the initial execution of the workflow.

#### The Code
``` javascript
var usher = require('usher');

var workflow = usher.workflow('linear-workflow', 'my-domain-name')
  .activity('activity1')
  .activity('activity2', ['activity1'])
  .activity('activity3', ['activity2'])
  .activity('activity4', ['activity3']);

workflow.start();
```

#### The Decider

The creation of the above workflow is broken into 2 primary parts. First the logic of the decider is defined with the `activity()` calls. Next the call to `start()` begins continuously polling for decision tasks (See [PollForDecisionTask](http://docs.aws.amazon.com/amazonswf/latest/apireference/API_PollForDecisionTask.html)).

As far as SWF is concerned, a PollForDecisionTask only requires 2 primary inputs, the `domain` and the `taskList`. For the above workflow, those values are:
+ `domain`: 'my-domain-name'
+ `taskList`: 'linear-workflow-tasklist'

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

## Documentation

+ [More Examples](./examples)
+ [JSDocs](./docs)

## License (MIT)

Copyright (c) 2014 meltmedia (mike@meltmedia.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
