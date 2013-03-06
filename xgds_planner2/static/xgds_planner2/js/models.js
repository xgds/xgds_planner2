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
    }

    models.Plan = Backbone.RelationalModel.extend({
        relations: [
            {
                type: Backbone.HasMany,
                relatedModel: 'app.models.Station',
                key: 'sequence',
                collectionType: 'app.models.StationCollection',
                createModels: true,
                reverseRelation:{
                    key: 'plan',
                    includeInJSON: false,
                },
            }
        ]
    });

    models.Station = Backbone.RelationalModel.extend({
        relations:[
            {
                type: Backbone.HasMany,
                relatedModel: 'app.models.Command',
                key: 'sequence',
                collectionType: 'app.models.CommandCollection',
                createModels: true,
                reverseRelation:{
                    key: 'station',
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

    });

    // If station parameters are specified in the planSchema,
    // override the default form schema, and automatically 
    // generate a form for it with django-forms,
    app.addInitializer(function() {
        if (app.planSchema.stationParams) {
            var stnSchema = {};
            _.each(app.planSchema.stationParams, function(param){
                stnSchema[param.id] = {type: app.models.paramTypeHash[param.valueType]};
            });
            app.models.Station.schema = stnSchema;
        }
    });
    

    models.StationCollection = Backbone.Collection.extend({
        model: models.Station,
    });

    
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
