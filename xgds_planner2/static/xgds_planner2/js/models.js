app.models = app.models || {};

(function(models){
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
    });

    models.StationCollection = Backbone.Collection.extend({
        model: models.Station,
    });

    
    // Map xpJSON parameter ValueTypes to backbone-forms schema field types
    var paramTypeHash = {
        'string': 'Text',
        'integer': 'Number',
        'number': 'Number',
        'boolean': 'Checkbox',
        'date-time': 'DateTime',
        'targetId': 'Select',
    }

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
