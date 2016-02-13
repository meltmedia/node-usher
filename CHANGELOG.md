## 0.1.0 (May 17, 2014)

+ Initial release

## 0.1.1 (June 18, 2014)

+ Update repository location in package.json

## 0.1.2 (June 18, 2014)

+ Enable input transformation via custom function for tasks via `transform` option

## 0.1.3 (June 18, 2014)

+ Moved `aws-sdk` lib to be in `peerDependencies` so that global AWS config can be inherited from parent project

## 0.2.0 (June 23, 2014)

+ Child Workflow Support
+ Looping Support
+ Small internal API refactor in support of above features

## 0.2.1 (July 24, 2014)

+ Updating to latest `aws-swf` dependency to support v2.x of the `aws-sdk` library

## 0.2.2 (Sept 3, 2014)

+ Resolved an uncaught exception when certain tasks failed

## 0.2.3 (Sept 9, 2014)

+ Support for Activity / Workflow options being functions that are evaluated within the context of the activities / workflows input

## 0.3.0 (Sept 19, 2014)

** WARNING: This release introduced breaking API changes in support of proper version handling of workflows **

+ Expanding scope of Usher to include the ability to manage Activities as well as Deciders
+ Full version support for Activities and Deciders using [semver](http://semver.org/) v2.0
  + This means that deciders / activities can be configured to match explicit or ranges of versions (think NPM module versions)

## 0.3.1 (Jan 6, 2015)

+ Implemented configurable batch scheduling logic for loops. Defaults to processing `20` items per batch with a `1` second Timer scheduled between batches. This is designed to mitigate `CHILD_CREATION_RATE_EXCEEDED` and `ACTIVITY_CREATION_RATE_EXCEEDED` exceptions seen in larger workflows.
+ Better handling of failure states in `loop` decisions.

## 0.3.2 (Jan 14, 2015)

+ Adding Marker event recording the current decider state when a decision can't be made.
+ Additional test cases for loops

## 0.3.3 (Jan 16, 2015)

+ Added additional debug logging

## 0.4.0 (Apr 3, 2015)

+ Added `whileLoop` decision type: loop over a fragment until a done condition is met

## 0.4.1 (Apr 5, 2015)

+ Support for nesting loops within each other. Nesting should be shallow (Ideally < 3 levels deep).

## 0.5.0 (Apr 8, 2015)

+ Adding `variable` decision type: allows storing values for future activities to use.
+ Resolved async bug in `loop` decisions where the state of the loop could have been evaluated before all task had completed.

## 0.5.1 (Apr 9, 2015)

+ Adding `ignoreFailures` option to child workflow task

## 0.5.2 / 0.5.3 (Apr 9, 2015)

+ Resolved issue when using batches in long loops
+ Updated aws-sdk to latest version

## 0.5.4 (Apr 13, 2015)

+ Resolved a potential race condition in workflow execution

## 0.6.0 (Jun 4, 2015)

+ Adding `register` method to both activities and workflows
+ Updated dependencies to latest versions

## 0.6.1 (July 7, 2015)

+ Fixing `undefined` error when starting and stopping pollers quickly, such as in unit tests

## 0.6.2 (July 14, 2015)

+ Allowing access to the raw `context` in transform and variable tasks

## 0.6.3 (Sept 21, 2015)

+ Updated dependencies to latest versions to resolve a race condition when using loops

## 0.6.4 (Nov 5, 2015)

+ Added `execute` method to Workflow as a utility method for finding the correct version and starting a workflow execution

## 0.6.5 (Nov 9, 2015)

+ Added support for tags in `execute` method
+ Updated default timeouts for `execute` method
+ Variable tasks will no longer set a marker if the value did not change

## 0.6.6 (Nov 9, 2015)

+ Resolved an issue when using a function in a tagList

## 0.6.7 (Nov 19, 2015)

+ Resolved an issue where calling execute on a workflow would not work
+ Pass through default options when executing workflows

## 0.7.0 (Nov 24, 2015)

+ Removing NPM shrinkwrap from module as best practices are to not include with libs

## 0.7.1 (Nov 24, 2015)

+ Adding defaults for `scheduleToStartTimeout`, `scheduleToCloseTimeout`, `startToCloseTimeout`, and `heartbeatTimeout`

## 0.8.0 (Feb 10, 2016)

+ Added `accumulator` decision type: accumulate the results of iterations of a fragment
+ Expand `Context.didChildWorkflowFail` to include timeout events
+ Added support for `maxOutstanding` flag on `loop` decisions

## 0.8.1 (Feb 10, 2016)

+ Expand `Context.didActivityFail` to include timeout events

## 0.8.2 (Feb 11, 2016)

+ Lodash 4.x compatibility changes

## 0.8.3 (Feb 11, 2016)

+ Cleanup some debug logging

## 0.8.4 (Feb 12, 2016)

+ Added `result` decision type so you can customize the output of a workflow.
+ Added `previousResult` variable to `accumulator` fragment input so patterns such as paging can be implemented.
