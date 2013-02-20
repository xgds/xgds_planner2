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
                    includeInJSON: true,
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

    models.Command = Backbone.RelationalModel.extend({
    });

    models.CommandCollection = Backbone.Collection.extend({
        model: models.Command,
    });

})(app.models);
