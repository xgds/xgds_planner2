//__BEGIN_LICENSE__
// Copyright (c) 2015, United States Government, as represented by the
// Administrator of the National Aeronautics and Space Administration.
// All rights reserved.
//
// The xGDS platform is licensed under the Apache License, Version 2.0
// (the "License"); you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// http://www.apache.org/licenses/LICENSE-2.0.
//
// Unless required by applicable law or agreed to in writing, software distributed
// under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
// CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.
//__END_LICENSE__

//
// Handlebars Template Helpers
//

// debug: prints the current template context, and optionally
// a specified value, to the console.
Handlebars.registerHelper('debug', function(optionalValue) {
    console.log('Current Context');
    console.log('====================');
    console.log(this);

    if (optionalValue) {
        console.log('Value');
        console.log('====================');
        console.log(optionalValue);
    }
});

Handlebars.registerHelper('getColor', function(key) {
    return app.reqres.request('getColor', key);
});

//
// Conditional that compares two values
//
Handlebars.registerHelper('ifequal', function(val1, val2, options) {
    if (val1 === val2) {
        return options.fn();
    }
    else {
        return options.inverse();
    }
});

Handlebars.registerHelper('getattr', function(obj, key) {
    return obj[key];
});

Handlebars.registerHelper('group', function(list, groupKey, options) {
    var ret = '';
    var groups = {};
    var groupNum = 0;
    _.each(list, function(item) {
        if (! _.has(groups, item[groupKey])) {
            groupNum++;
            groups[item[groupKey]] = {
                groupName: item[groupKey],
                groupNumber: groupNum,
                items: []
            };
        }
        groups[item[groupKey]].items.push(item);
    });
    groups = _.sortBy(groups, 'groupName');

    _.each(groups, function(group) {
        ret = ret + options.fn(group);
    });
    return ret;
});

Handlebars.registerHelper('firstDefined', function() {
    // given a list of values, regurn the first one defined within this context
    var args = Array.prototype.slice.call(arguments);
    var val;
    while (args.length > 0) {
        val = args.shift();
        if (val != undefined) { return val; }
    }
    return undefined;

});
