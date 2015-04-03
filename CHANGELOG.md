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
