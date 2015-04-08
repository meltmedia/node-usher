/*!
 * Usher
 * Copyright(c) 2014 meltmedia <mike@meltmedia.com>
 */

'use strict';


module.exports = Task;


function Task(name, deps) {
  if (!(this instanceof Task)) {
    return new Task(name, deps);
  }

  this.name = name;
  this.deps = deps || [];
}


Task.prototype.execute = function execute() { // ctx, done
  // Do Nothing
};
