Usher
=====

Usher enables simple, dependency based compositions of activities and decisions for AWS Simple Workflows.

In the name of simplicity, this library has strong opinions on convention, with the ability to configure and override some of these conventions.

This library can be used to implement [Deciders](http://docs.aws.amazon.com/amazonswf/latest/developerguide/swf-dev-actors.html#swf-dev-actors-deciders) and [Activities](http://docs.aws.amazon.com/amazonswf/latest/developerguide/swf-dev-actors.html#swf-dev-actors-activities) for AWS [Simple Workflow Service](http://aws.amazon.com/swf/).


## Install

```
npm install usher --save
```

## Usage

### Activities

This is a simple example of 4 activities being defined to perform some tasks and returning their results. By themselves, these activities will do nothing until executed by a workflow. (To see how these activities are run, see the workflow example below.)

``` javascript
var usher = require('usher');

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

activities.start();
```

### Workflow (Decider) - Linear

This is a simple example of the workflow composition that will run the previously defined 4 activities in sequential order when the workflow is executed.

``` javascript
var usher = require('usher');

var workflow = usher
  .workflow('linear-workflow', 'my-domain-name')
    .version('1.0.0')
      .activity('activity1')
      .activity('activity2', ['activity1'])
      .activity('activity3', ['activity2'])
      .activity('activity4', ['activity3'], { version: '1.1.0' });

workflow.start();
```

### Running a Workflow

Given the above defined `linear-workflow`, you could run an execution of the workflow in the following way.

``` javascript
var usher = require('usher');

// This assumes the workflow 'linerar-workflow' has already been defined previously
var workflow = usher.workflow('linear-workflow', 'my-domain-name');

workflow.execute({ key: 'value '}, function (err, runId, workflowId) {
  // once the workflow has started
});
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
