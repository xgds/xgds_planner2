app.models = app.models || {};

(function(models){

    // Map xpJSON parameter ValueTypes to backbone-forms schema field types
    models.paramTypeHash = {
        'string': 'Text',
        'integer': 'Number',
        'number': 'Number',
        'boolean': 'Checkbox',
        'date-time': 'DateTime',
        'targetId': 'Select',
    };

    models.Plan = Backbone.RelationalModel.extend({
        relations: [
            {
                type: Backbone.HasMany,
                relatedModel: 'app.models.PathElement',
                key: 'sequence',
                collectionType: 'app.models.PathSequenceCollection',
                createModels: true,
                reverseRelation:{
                    key: 'plan',
                    includeInJSON: false,
                },
            }
        ]
    });

    /*
    ** The PathElement model represents both Station and Sequence objects.
    ** This is inconvenient, but it has to be this way until we invent
    ** a Collection that can instantiate more than one model type.
    */
    models.PathElement = Backbone.RelationalModel.extend({
        idAttribute: "_id",
        relations:[
            {
                type: Backbone.HasMany,
                relatedModel: 'app.models.Command',
                key: 'sequence',
                collectionType: 'app.models.CommandCollection',
                createModels: true,
                reverseRelation:{
                    key: 'pathElement',
                },
            },
        ],
        schema: {
            id: 'Text',
            tolerance: 'Number',
            headingDegrees: 'Number',
            headingToleranceDegrees: 'Number',
        },

        toString: function(){
            return this.get('id');
        },

        toJSON: function(){
            var obj = Backbone.RelationalModel.prototype.toJSON.apply(this);
            if ( _.has(obj, 'sequenceLabel') ){
                // exclude this from the serialized version
                delete obj.sequenceLabel;
            }
            return obj;
        },

        initialize: function(){
            var params = {
                'Station': app.planSchema.stationParams,
                'Segment': app.planSchema.segmentParams,
            }[this.get('type')];
            if (params) {
                var schema = {};
                _.each(params, function(param){
                    schema[param.id] = {type: app.models.paramTypeHash[param.valueType]};
                });
                this.schema = schema;
            }
            
        },

        /*
        ** Relevant to stations only...
        ** A convenience mainly to keep details about the model's structure
        ** out of the map drag handler.
        */
        setPoint: function(lon, lat) {
            var geom = this.get('geometry');
            if (! geom) { throw "PathElement has no geometry"; }
            geom.coordinates = [lon, lat];
            this.set('geometry', geom);
        },
    });

    models.PathSequenceCollection = Backbone.Collection.extend({
        model: models.PathElement,

        initialize: function(){
            this.on('add remove', this.resequence, this);
        },

        /*
        ** resequence supplies the stations with easier to read sequential numbers
        ** for use in the map view. (Start, 1, 2...End)
        ** It is also responsible for computing station and sequence ids from the templates in planSchema.
        */
        resequence: function(){
            var stationCounter = 0;

            // Natural station numbering.
            this.each(
                function( item, idx, list ) {
                    var itemType = item.get('type');
                    if (itemType == 'Station') {
                        var sequenceLabel, length = list.length;
                        if (stationCounter === 0) {
                            sequenceLabel = 'Start';
                        } else if ( idx == length - 1 ) {
                            sequenceLabel = 'End';
                        } else {
                            sequenceLabel = ''+stationCounter;
                        }
                        item.set('sequenceLabel', sequenceLabel);
                        stationCounter++;
                    }


                    // Item ID template formatting
                    var template = {
                        'Station': app.planSchema.stationIdFormat,
                        'Segment': app.planSchema.segmentIdFormat
                    }[itemType];

                    var context = {
                        plan: app.currentPlan.toJSON(),
                        stationIndex: idx
                    };
                    context[itemType.toLowerCase()] = item;

                    var stationId = template.format(context);
                    item.set('id', stationId);
                }
            );
        },

        /*
        This collection needs special logic to maintain
        the station-segment-station adjecency.
        */ 
        appendStation: function(stationModel){
            var segment = models.segmentFactory();
            this.add([segment, stationModel]);
        },
        
        /*
        Insert a station just before the segment at the given index.
        Also add a new segment.
        */
        insertStation: function(idx, stationModel){
            var segmentAfter = this.at(idx);
            if ( ! segmentAfter.get('type') == "Segment" ) { throw "You can only insert stations before a Segment." }
            var segmentBefore = models.segmentFactory({}, segmentAfter); // Clone the stationAfter's properties.
            this.add([segmentBefore, stationModel], {at: idx} );
        },

        removeStation: function(stationModel){
            var idx = this.indexOf(stationModel);
            var segment;
            if (idx < 0) { alert("Station not present in collection"); }
            else if ( idx === 0 ) {
                segment = this.at(1);
            } else {
                segment = this.at(idx-1);
            }
            this.remove([stationModel, segment]);
        },
    });

    /*
    ** The factories below contain proto objects that act as
    ** templates for creating new Station and Segment PathElement
    ** models when the user adds them from the map display.
    */

    models.stationFactory = function(options, stationToClone) {
        var proto = {
            "geometry": {
                "coordinates": [],
                "type": "Point"
            },
            "headingDegrees": 0,
            "headingToleranceDegrees": 9.740282517223996,
            "id": "",
            "isDirectional": false,
            "sequence": [],
            "tolerance": 1,
            "type": "Station"
        };
        if (stationToClone) { proto = stationToClone.toJSON(); } 
        _.defaults(options, proto);

        if (options.coordinates) {
            options.geometry.coordinates = options.coordinates;
            delete options.coordinates;
        }

        if ( !options.id ){
            //TODO: interperet id template
            options.id = _.uniqueId('station_');
        }

        return new models.PathElement(options);

    };

    models.segmentFactory = function(options, segmentToClone){
        if ( _.isUndefined(options) ) { options = {}; }
        var proto = {
            "hintedSpeed": 1,
            "id": "",
            "sequence": [],
            "type": "Segment"
        };
        if (segmentToClone) { 
            proto = segmentToClone.toJSON(); 
            delete proto.id;
        }
        _.defaults(options, proto);
        
        if ( !options.id ){
            //TODO: interperet id template
            options.id = _.uniqueId('segment_');
        }
        return new models.PathElement(options);

    };

    
    models.Command = Backbone.RelationalModel.extend({
        initialize: function(){

            /*
            // Construct a schema compatible with backbone-forms
            // https://github.com/powmedia/backbone-forms#schema-definition
            var schema = {};
            var commandSpec = app.commandSpecs[this.get('type')];
            _.each(commandSpec.params, function(param){
                schema[param.id] = paramTypeHash[param.valueType];
            });
            this.schema = schema;
            */

        },
    });

    models.CommandCollection = Backbone.Collection.extend({
        model: models.Command,
    });

})(app.models);
