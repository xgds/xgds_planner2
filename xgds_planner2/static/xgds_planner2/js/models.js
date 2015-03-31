// __BEGIN_LICENSE__
//Copyright (c) 2015, United States Government, as represented by the 
//Administrator of the National Aeronautics and Space Administration. 
//All rights reserved.
//
//The xGDS platform is licensed under the Apache License, Version 2.0 
//(the "License"); you may not use this file except in compliance with the License. 
//You may obtain a copy of the License at 
//http://www.apache.org/licenses/LICENSE-2.0.
//
//Unless required by applicable law or agreed to in writing, software distributed 
//under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR 
//CONDITIONS OF ANY KIND, either express or implied. See the License for the 
//specific language governing permissions and limitations under the License.
// __END_LICENSE__

app.models = app.models || {};

(function(models) {

    // Map xpJSON parameter ValueTypes to backbone-forms schema field types
    models.paramTypeHash = {
        'string': 'Text',
        'integer': 'Number',
        'number': 'Number',
        'boolean': 'Checkbox',
        'date-time': 'DateTime',
        'targetId': 'Select',
        'h:m:s': 'HMS'
    };

    models.widgetTypeHash = {
        'text': 'Text',
        'number': 'Number',
        'checkbox': 'Checkbox',
        'datetime': 'DateTime',
        'select': 'Select',
        'textarea': 'TextArea',
        'h:m:s': 'HMS'
    };

    models.paramBlackList = [
        '_id',
        '_siteFrame'
    ];

    function xpjsonToBackboneFormsSchema(params, modelType) {

        // name and notes are hard-coded fields from xpjson spec
        var schema = {
            name: {type: 'Text'},
            notes: {type: 'TextArea'},
            id: {type: 'Text', readonly: true,
                 editorAttrs: { disabled: true}}
        };

        // data object contains object defaults
        var data = {
        };

        if (modelType == 'Station') {
            if (!_.isUndefined(app.planJson)){
                if (_.has(app.planJson.site, 'alternateCrs') && !_.isNull(app.planJson.site.alternateCrs)) {
                    var siteFrameLabel = _.has(app.planJson.site.alternateCrs.properties, 'label') ?
                        app.planJson.site.alternateCrs.properties.label : 'Site Frame';
                    schema._siteFrame = {type: 'Select', options: [{label: 'Lng, Lat', val: false},
                                                                   {label: siteFrameLabel, val: true}],
                                         title: 'Coordinate System'};
                }
            }
            // TODO: Create a "Coordinates" editor that's geometry-schema-aware
            schema.geometry = {type: 'Coordinates',
                              title: 'Lon, Lat'};
        }

        if (modelType == 'Plan') {
            schema.creator = {type: 'Text', readonly: true,
                              editorAttrs: { disabled: true }};
            schema.planVersion = {type: 'Text', title: 'Plan Version'};
        }

        _.each(params, function(param) {
            var foundType;

            if (_.has(param, 'widget')) {
                foundType = app.models.widgetTypeHash[param.widget];
            } else {
                foundType = app.models.paramTypeHash[param.valueType];
            }

            if (foundType == 'Number' && (_.has(param, 'minimum') ||
                                          _.has(param, 'maximum'))) {
                foundType = 'MinMaxNumber';
            }

            if (_.has(param, 'choices') &&
                (foundType != 'Select' || foundType != 'Checkbox')) {
                if (foundType == 'Number') {
                    foundType = 'NumberSelect';
                } else {
                    foundType = 'Select';
                }
            }
            if (foundType == 'Select' || foundType == 'NumberSelect') {
                var options = _.map(param.choices, function(choice) {
                    var obj = {
                        val: choice[0],
                        label: choice[1]
                    };
                    return obj;
                });
                schema[param.id] = {'type': foundType, 'validators': [], options: options};
            } else {
                schema[param.id] = {'type': foundType, 'validators': []};
            }
            if (_.has(param, 'name')) {
                schema[param.id]['title'] = param.name;
            } else {
                // default to using parameter id for its name
                // your parameters shouldn't do this by default
                schema[param.id]['title'] = param.id;
            }
            if (param.valueType != 'boolean' &&
                _.has(param, 'required') &&
                _.isBoolean(param.required) &&
                param.required) {
                schema[param.id]['validators'].push('required');
            }
            if (_.has(param, 'notes')) {
                schema[param.id]['help'] = param.notes;
            }
            if (_.has(param, 'default')) {
                data[param.id] = param.default;
            }
            if (_.has(param, 'unit')) {
                schema[param.id]['unit'] = param.unit;
            }
            if (_.has(param, 'minimum')) {
                schema[param.id]['minimum'] = param.minimum;
            }
            if (_.has(param, 'maximum')) {
                schema[param.id]['maximum'] = param.maximum;
            }
            if (_.has(param, 'strictMinimum')) {
                schema[param.id]['strictMinimum'] = param.strictMinimum;
            }
            if (_.has(param, 'strictMaximum')) {
                schema[param.id]['strictMaximum'] = param.strictMaximum;
            }
            if (_.has(param, 'visible') &&
                    _.isBoolean(param.visible) &&
                    !param.visible) {
                schema[param.id]['type'] = 'Hidden';
            }
            if (_.has(param, 'editable') &&
                    _.isBoolean(param.editable) &&
                    !param.editable) {
                schema[param.id]['editorAttrs'] = {
                        readonly: true,
                        disabled: true
                    };
            }
        });

        return {
            schema: schema,
            data: data
        };
    }

    function toJsonWithFilters() {
        var obj = Backbone.RelationalModel.prototype.toJSON.apply(this);
        _.each(_.keys(obj), function(key) {
            if (_.isNull(obj[key]) || _.contains(models.paramBlackList, key) ||
               (_.isString(obj[key]) && _.isEmpty(obj[key]))) {
                delete obj[key];
            }
        });
        return obj;
    };

    models.Plan = Backbone.RelationalModel.extend({
        url: function() {
            // return '/xgds_planner2/plan/{uuid}/{name}.json'.format({name:
            // this.get('name')});
            return this.get('url');
        },
        isNew: function() {
            /*
             * The way we have things set up, plan models can never be new,
             * since we create the on the server side before passing them to the
             * app. Backbone uses this value on sync/save to determine whether
             * to sent a POST request or a PUT request. Setting it to always be
             * false forces a PUT. The default implementation is: "return
             * this.id == null"
             */
            return _.isNull(app.currentPlan.get('uuid'));
        },
        relations: [
            {
                type: Backbone.HasMany,
                relatedModel: 'app.models.PathElement',
                key: 'sequence',
                collectionType: 'app.models.PathSequenceCollection',
                createModels: true,
                reverseRelation: {
                    key: 'plan',
                    includeInJSON: false
                }
            }
        ],

        initialize: function() {
            var params = app.planSchema.planParams;
            this.schema = {
                // put static schema elements here
            };
            this.data = {
                // put static data elements here
            };
            var formsData = xpjsonToBackboneFormsSchema(params, 'Plan');
            _.extend(this.schema, formsData.schema);
            _.extend(this.data, formsData.data);
            this.on('change', function() {
                app.vent.trigger('change:plan');
            });
        },

        toJSON: toJsonWithFilters
        
    });

    /*
     * * The PathElement model represents both Station and Sequence objects. *
     * This is inconvenient, but it has to be this way until we invent * a
     * Collection that can instantiate more than one model type.
     */
    models.PathElement = Backbone.RelationalModel.extend({
        idAttribute: '_id', // Doesn't exist, but allows us to change the "id"
        // attribute with impunity.
        relations: [
            {
                type: Backbone.HasMany,
                relatedModel: 'app.models.Command',
                key: 'sequence',
                collectionType: 'app.models.CommandCollection',
                createModels: true,
                reverseRelation: {
                    key: 'pathElement'
                }
            }
        ],

        schema: {
            // id: 'Text'
            // tolerance: 'Number',
            // headingDegrees: 'Number',
            // headingToleranceDegrees: 'Number',
        },

        data: {
        },

        initialize: function() {
            // javascript is a weird beast and requires re-definition of this
            // variable,
            // or else stuff is added to it
            this.schema = {
                // id: 'Text'
                // tolerance: 'Number',
                // headingDegrees: 'Number',
                // headingToleranceDegrees: 'Number',
            };
            this.data = {
            };
            var params = {
                'Station': app.planSchema.stationParams,
                'Segment': app.planSchema.segmentParams
            }[this.get('type')] || {};
            var formsData = xpjsonToBackboneFormsSchema(params, this.get('type'));
            _.extend(this.schema, formsData.schema);
            _.extend(this.data, formsData.data);
            this.on('change', function() {
                var changed = this.changedAttributes();
                var previous = this.previousAttributes();
                _.find(_.keys(changed), function(item) {
                    if (!_.contains(models.paramBlackList, item) &&
                        (_.has(previous, item) || !_.isEmpty(changed[item]))
                       ) {
                        app.vent.trigger('change:plan');
                        return true;
                    }
                });
            });
            // this model needs an id attribute b/c relational can't find old
            // models
            // and so creates infinite new ones
            // furthermore, this id needs to be the same as cid. Oh
            // relational...
            this.set(this.idAttribute, this.cid);
        },

        toString: function() {
            var repr;
            switch (this.get('type')) {
            case 'Station':
                repr = this._sequenceLabel;
                break;
            case 'Segment':
                repr = Math.round(this._segmentLength) + ' meters';
                break;
            }
            return repr;
        },

        toJSON: toJsonWithFilters,

        getDuration: function() {
            /*
             * var duration = 0.0; if ( this.get('speed') ) { // TODO: calculate
             * distance and traverse time }
             * this.get('sequence').each(function(command) { if
             * (command.get('duration') != undefined) { duration = duration +
             * command.get('duration'); } }); return duration;
             */
            // actually use the simulator
            if (this._simInfo == undefined) app.simulatePlan();
            if (this._simInfo == undefined) return undefined;
            return this._simInfo.deltaTimeSeconds / 60;
        },

        getCumulativeDuration: function(collection) {
            /*
             * // return the cumulative duration of all models in the collection
             * up to and including this one. if ( collection === undefined ) {
             * collection = app.currentPlan.get('sequence'); } var arr =
             * collection.models; var idx = _.indexOf(arr, this); if (idx < 0) {
             * throw 'Model {model} was not found in the collection
             * {collection}'.format({model: this, collection: collection}); }
             * var duration = 0.0; _.each(_.first(arr, idx + 1), function(model) {
             * duration = duration + model.getDuration(); } ); return duration;
             */
            if (this._simInfo == undefined) app.simulatePlan();
            if (this._simInfo == undefined) return undefined;
            var addme = 0;
            if (this._simInfo.elapsedTimeSeconds > 0){
                addme = this._simInfo.elapsedTimeSeconds / 60;
            }
            return addme + this.getDuration();
        },

        appendCommandByPreset: function(preset) {
            var command = new models.Command(preset);
            if (!_.isUndefined(preset.presetName)){
                command.set('name', preset.presetName);
            } else {
                command.set('name', preset.name);
            }
            command.parent = this;
            this.get('sequence').add(command);
        },

        appendCommandModel: function(model) {
            model.parent = this;
            this.get('sequence').add(model);
        },
        /*
         * * Relevant to stations only... * A convenience mainly to keep details
         * about the model's structure * out of the map drag handler.
         */
        setPoint: function(coords) {
            var geom = this.get('geometry');
            geom = _.extend({}, geom); // make a copy so it triggers the change
            // event
            if (! geom) { throw 'PathElement has no geometry'; }
            geom.coordinates = [coords.lng, coords.lat];
            this.set('geometry', geom);
        }
    });

    models.PathSequenceCollection = Backbone.Collection.extend({
        model: models.PathElement,

        initialize: function() {
            this.on('add remove', this.resequence, this);
        },

        /*
         * * resequence supplies the stations with easier to read sequential
         * numbers * for use in the map view. (Start, 1, 2...End) * It is also
         * responsible for computing station and sequence ids from the templates
         * in planSchema.
         */
        resequence: function() {
            var stationCounter = 0;

            if (!_.isUndefined(app.Actions) && !_.isUndefined(app.Actions.disable)) {
                // prevent undo from capturing *every* change we make
                app.Actions.disable();
            }

            // Natural station numbering.
            this.each(
                function(item, idx, list) {
                    var itemType = item.get('type');
                    if (itemType == 'Station') {
                        var sequenceLabel, length = list.length;
                        if (stationCounter === 0) {
                            sequenceLabel = 'Start';
                        } else if (idx == length - 1) {
                            sequenceLabel = 'End';
                        } else {
                            sequenceLabel = '' + stationCounter;
                        }
                        item._sequenceLabel = sequenceLabel;
                    }

                    // Item ID template formatting
                    var template = {
                        'Station': app.planSchema.stationIdFormat,
                        'Segment': app.planSchema.segmentIdFormat
                    }[itemType];

                    var context = {
                        plan: app.planJson, //.currentPlan.toJSON(),
                        stationIndex: stationCounter
                    };
                    context[itemType.toLowerCase()] = item;

                    if (app.planJson){
                        var stationId = template.format(context);
                        item.set('id', stationId);
                        item.trigger('change')
                        
                    }
                    if (itemType == 'Station') {
                        stationCounter++;
                    }
                }
            );

            if (!_.isUndefined(app.Actions) && !_.isUndefined(app.Actions.enable)) {
                app.Actions.enable();
            }

            app.vent.trigger('change:plan');
        },

        /*
         * This collection needs special logic to maintain the
         * station-segment-station adjecency.
         */
        appendStation: function(stationModel) {
            var segment = undefined;
            app.Actions.disable();
            if (this.length > 0) { // Don't append a segment if this is the
                // first station in the list.
                segment = models.segmentFactory();
                this.add([segment, stationModel]);
            } else {
                this.add(stationModel);
            }
            app.Actions.enable();
            app.Actions.action();
            app.vent.trigger('station:change');
            return segment;
        },

        /*
         * Insert a station just before the segment at the given index. Also add
         * a new segment.
         */
        insertStation: function(segmentAfter, stationModel) {
            if (segmentAfter.get('type') != 'Segment') { throw 'You can only insert stations before a Segment.'}
            // Clone the stationAfter's properties
            var segmentBefore = models.segmentFactory({}, segmentAfter); 
            var seq = this.plan.get('sequence');
            var idx = seq.indexOf(segmentAfter);
            this.add([segmentBefore, stationModel], {at: idx});
            app.vent.trigger('station:change');
            segmentAfter.trigger('alter:stations'); 
            return segmentBefore;

        },

        removeStation: function(stationModel) {
            var idx = this.indexOf(stationModel);
            var segment;
            if (idx < 0) { alert('Station not present in collection'); }
            else if (idx === 0) {
                segment = this.at(1);
            } else {
                segment = this.at(idx - 1);
            }
            // for whatever reason, relational would rather
            // you remove the segment first.
            // disable actions so that the segment and
            // the station get removed in the same action
            app.Actions.disable();
            var nextSegment;
//            var prevStation;
            if (idx < this.length){
                // next segment needs to be updated
                nextSegment = this.at(idx + 1);
                if (!_.isUndefined(nextSegment)) {
//                    if (idx - 2 >= 0){
//                        prevStation = this.at(idx - 2);
//                    }
                }
            }
            this.remove([segment, stationModel]);
            
            app.vent.trigger('station:change', stationModel);
            app.vent.trigger('station:remove', stationModel);
            stationModel.trigger('station:remove');
            if (!_.isUndefined(segment)){
                segment.trigger('segment:remove');
            }
            if (!_.isUndefined(nextSegment) && (segment != nextSegment)){
                nextSegment.trigger('alter:stations'); 
            }
            app.Actions.enable();
            app.Actions.action();
            return segment;
        }
    });

    /*
     * * The factories below contain proto objects that act as * templates for
     * creating new Station and Segment PathElement * models when the user adds
     * them from the map display.
     */

    models.stationFactory = function(options, stationToClone) {
        var proto = {
            'geometry': {
                'coordinates': [],
                'type': 'Point'
            },
            // "headingDegrees": 0,
            // "headingToleranceDegrees": 9.740282517223996,
            'id': '',
            // "isDirectional": false,
            'sequence': [],
            // "tolerance": 1,
            'type': 'Station'
        };
        _.each(app.planSchema.stationParams, function(param) {
            proto[param['id']] = param['default'];
        });
        if (stationToClone) { proto = stationToClone.toJSON(); }
        _.defaults(options, proto);

        if (options.coordinates) {
            options.geometry.coordinates = options.coordinates;
            delete options.coordinates;
        }

        if (!options.id) {
            // TODO: interperet id template
            options.id = _.uniqueId('station_');
        }

        return new models.PathElement(options);

    };

    models.segmentFactory = function(options, segmentToClone) {
        if (_.isUndefined(options)) { options = {}; }
        var proto = {
            // "hintedSpeed": 1,
            'id': '',
            'sequence': [],
            'type': 'Segment'
        };
        _.each(app.planSchema.segmentParams, function(param) {
            proto[param['id']] = param['default'];
        });
        if (segmentToClone) {
            proto = segmentToClone.toJSON();
            if (_.has(proto, segmentToClone.idAttribute)) {
                delete proto[segmentToClone.idAttribute];
            }
        }
        _.defaults(options, proto);

        if (!options.id) {
            // TODO: interperet id template
            options.id = _.uniqueId('segment_');
        }
        return new models.PathElement(options);

    };


    models.Command = Backbone.RelationalModel.extend({
        idAttribute: '_id', // prevent clobbering command ID's

        initialize: function() {
            // Construct a schema compatible with backbone-forms
            // https://github.com/powmedia/backbone-forms#schema-definition
            this.schema = {
                // put static schema elements here
            };
            this.data = {
                // put static data elements here
            };
            // this is to fix old/bad plans with lawnmowers. total hack.
            if (this.get('type') == 'LawnmowerPattern') {
                this.set('type', 'RasterPattern');
            }
            var params = app.commandSpecs[this.get('type')].params;
            var formsData = xpjsonToBackboneFormsSchema(params, 'Command');
            _.extend(this.schema, formsData.schema);
            _.extend(this.data, formsData.data);
            this.on('change', function() { app.vent.trigger('change:plan'); });
            // all attributes in the schema need to be defined, else they won't
            // be in the
            // json and so won't change when undo/redo is hit
            _.each(_.keys(this.schema), function(attr) {
                if (!this.has(attr)) {
                    if (_.has(this.data, attr)) {
                        this.set(attr, this.data[attr]);
                    }
                }
            }, this);
            // the model needs an "id" attribute, else a memory leak occurs b/c
            // relational can't find the model (it tries to use the id
            // attribute)
            // and so creates a new one, which is bad
            this.set(this.idAttribute, this.cid);
            var commandLabel = this.get('name');
            if (_.isUndefined(commandLabel)){
                commandLabel = "";
            }
            this._commandLabel = commandLabel;
        },

        hasParam: function(paramName) {
            // return true if the given param name exists in this command's spec
            var params = app.commandSpecs[this.get('type')].params;
            var paramNames = _.pluck(params, 'id');
            return _.contains(paramNames, paramName);
        },

        sync: function() {
            // this isn't a model on a remote server, so do nothing
            return;
        }
    });

    models.CommandCollection = Backbone.Collection.extend({
        model: models.Command,

        initialize: function() {
            this.on('add', this.updateCommandIds, this);
            this.on('remove', this.updateCommandIds, this);
            this.on('change', this.updateCommandIds, this);
        },

        /*
         * * resequence computes command ids from the templates
         * in planSchema.
         */
        updateCommandIds: function() {
            if (_.isUndefined(app.currentPlan)) {
                return;
            }
            if (!_.isUndefined(app.Actions) && !_.isUndefined(app.Actions.disable)) {
                // prevent undo from capturing *every* change we make
                app.Actions.disable();
            }

            var defaultParent = null;
            var template = app.planSchema.commandIdFormat;
            // TODO the backbone model does not use the dot interpretation to get attributes
//          "commandIdFormat": "{parent.id}_{commandIndex:01d}_{command.presetCode}",
            this.each(
                function(item, idx, list) {
                    var myparent = item.get('pathElement');
                    if (myparent == null) {
                        myparent = item.parent;
                    }
                    if (myparent != null) {
                        defaultParent = myparent;
                    } else {
                        myparent = defaultParent;
                    }
                    var parentId = '';
                    if (myparent != null) {
                        parentId = myparent.get('id');
                    }
                    parentDict = {'id': parentId };
                    var commandPreset = item.get('presetCode');
                    if (_.isUndefined(commandPreset)){
                        commandPreset = item.get('type');
                    }
                    commandDict = {'presetCode': commandPreset};
                    var context = {
                        parent: parentDict,
                        commandIndex: idx,
                        command: commandDict
                    };

                    var commandId = template.format(context);
                    item.set('id', commandId);
                }
            );

            if (!_.isUndefined(app.Actions) && !_.isUndefined(app.Actions.enable)) {
                app.Actions.enable();
            }

            app.vent.trigger('change:plan');
        }


    });

})(app.models);
