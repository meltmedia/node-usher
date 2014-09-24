/*!
 * Usher
 * Copyright(c) 2014 meltmedia <mike@meltmedia.com>
 */

'use strict';


module.exports = ActivityRunner;


function ActivityRunner(name, version, activityFn) {
  if (!(this instanceof ActivityRunner)) {
    return new ActivityRunner(name, version, activityFn);
  }

  this.name = name;
  this.version = version;
  this.activityFn = activityFn || function (task) { return task.success(); };
}


ActivityRunner.prototype.execute = function execute(task) {
  this.activityFn.call(this, task);
};
