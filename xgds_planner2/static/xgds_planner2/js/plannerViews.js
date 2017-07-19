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

app.views = app.views || {};
var printedDuration = function(seconds){
	var duration = moment.duration(seconds, 'seconds');
	if (duration.asDays() > 1.0) {
		return sprintf('%02dd %02d:%02d:%02d (days hh:mm:ss)', duration.days(), duration.hours(), duration.minutes(), duration.seconds());
	}
	else {
		return sprintf('%02d:%02d:%02d (hh:mm:ss)', duration.hours(), duration.minutes(), duration.seconds());
	}
};

Handlebars.registerHelper('formatDuration', function(seconds){
	return printedDuration(seconds);
});

Handlebars.registerHelper('formatDistance', function(distance){
	return sprintf('%0.2f m', distance);
});

app.views.ToolbarView = Marionette.View.extend({
    template: '#template-toolbar',
    saving: false,
    events: {
        'click #btn-navigate': function() { app.vent.trigger('mapmode', 'navigate'); this.updateTip('clear');},
        'click #btn-reposition': function() { app.vent.trigger('mapmode', 'reposition'); this.updateTip('edit'); },
        'click #btn-addStations': function() { app.vent.trigger('mapmode', 'addStations'); this.updateTip('add');},
        'click #btn-save': function() { this.doSavePlan(); },
        'click #btn-saveas': function() { this.showSaveAsDialog(); },
        'click #btn-undo': function() { app.Actions.undo(); },
        'click #btn-redo': function() { app.Actions.redo(); }
    },

    initialize: function() {
        this.listenTo(app.vent, 'mapmode', this.ensureToggle);
        
        this.listenTo(app.vent, 'clearSaveStatus', function(model) {this.updateSaveStatus('clear')});
        this.listenTo(app.vent, 'readOnly', function(model) {this.updateSaveStatus('readOnly')});
        this.listenTo(app.vent, 'readOnly', this.disableForReadOnly);
        this.listenTo(app.vent, 'undoEmpty', this.disableUndo);
        this.listenTo(app.vent, 'redoEmpty', this.disableRedo);
        this.listenTo(app.vent, 'undoNotEmpty', this.enableUndo);
        this.listenTo(app.vent, 'redoNotEmpty', this.enableRedo);
        this.listenTo(app.vent, 'updatePlanDuration', function() {
        	this.updateDurationDistance();
        });
        this.listenTo(app.vent, 'onPlanLoaded', function() {
        	this.listenTo(app.vent, 'change:plan', function(model) {
        		if (!context.saving){
        			this.updateSaveStatus('change')}
        		}
        	);
        	var context = this;
        	app.currentPlan.on('change', function() {
        		if (!context.saving){
        			app.vent.trigger('change:plan');
        		}
            });
//        	this.listenTo(app.currentPlan, 'sync', function(model) {this.updateSaveStatus('sync')});
            this.listenTo(app.currentPlan, 'sync', this.refreshSaveAs);
            this.listenTo(app.currentPlan, 'change:planVersion', this.handleVersionChange);
            this.listenTo(app.currentPlan, 'error', function(model) {this.updateSaveStatus('error')});
            this.render();
            if (app.isEmptyPlan()) {
            	app.vent.trigger('mapmode', 'addStations');
            } else {
            	app.vent.trigger('mapmode', 'navigate');
            }
       });
    },
    
    doSavePlan: function() {
    	app.simulatePlan(); 
    	this.saving = true;
    	var context = this;
    	this.updateSaveStatus('saving');
    	app.currentPlan.save(app.currentPlan.attributes, {success: function(model, response, options) {context.saveWorked(model, response, options);},
    												      error: function(model, response, options) {context.saveError(model, response, options);}});
    },
    saveWorked: function(model, response, options) {
    	this.saving = false;
    	this.updateSaveStatus('sync');
    },
    saveError: function(model, response, options) {
    	this.saving = false;
    	console.log('SAVE ERROR');
    	console.log(response);
    	this.updateSaveStatus('error');
    },

    onAttach: function() {
    	if (!app.State.mapHeightSet) {
    		var offset = this.$el.height() +
    		parseFloat(this.$el.parent().css('margin-top')) +
    		parseFloat(this.$el.parent().css('margin-bottom')) +
    		10; // this exact number is needed because jquery ui uses
    		// elements with absolute positioning for the resize handles

    		app.State.mapHeightSet = true;
    		app.vent.trigger('doMapResize');
    	}
    },
    templateContext: function() {
    	var simInfo = null;
    	if (app.currentPlan) {
    		simInfo = app.currentPlan._simInfo;
    	}
    	var data = {
    			stationMoniker: app.planLinks,
    			stationMonikerPlural: app.planNamedURLs,
    			simInfo: simInfo
    	}
    	return data;
    },
    onRender: function() {
        if (app.Actions.undoEmpty()) {
            this.disableUndo();
        } else {
            this.enableUndo();
        }
        if (app.Actions.redoEmpty()) {
            this.disableRedo();
        } else {
            this.enableRedo();
        }
    },
    updateDurationDistance: function() {
    	var simInfo = app.currentPlan._simInfo;
    	$("#totalDuration").text(printedDuration(simInfo.deltaTimeSeconds));
    	$("#totalDistance").text(sprintf('%0.2f m', simInfo.deltaDistanceMeters));
    },

    disableForReadOnly: function() {
        this.$('#btn-addStations').attr('disabled', 'true');
        this.$('#btn-reposition').attr('disabled', 'true');
        this.$('#btn-save').attr('disabled', 'true');
    },

    disableUndo: function() {
        this.$('#btn-undo').attr('disabled', 'true');
    },

    disableRedo: function() {
        this.$('#btn-redo').attr('disabled', 'true');
    },

    enableUndo: function() {
        this.$('#btn-undo').removeAttr('disabled');
    },

    enableRedo: function() {
        this.$('#btn-redo').removeAttr('disabled');
    },

    ensureToggle: function(modeName) {
        var btn = $('#btn-' + modeName);
        if (! btn.hasClass('active')) { 
            btn.prop("checked", true); 
            btn.addClass('active');
        }
        // turn off the others
        btn.siblings().each(function() {
            $(this).prop("checked", false);
            $(this).removeClass("active");
        });
    },

    msgMap :{
        'change': 'Unsaved changes.',
        'sync': app.options.planMoniker + ' saved.',
        'saving': 'Saving ' + app.options.planMoniker+ '.',
        'error': 'Save error.',
        'clear': '',
        'readOnly': app.options.planMoniker + ' is LOCKED.'
    },
    updateSaveStatus: function(eventName) {
    	if (eventName == 'change' && this.saving){
    		return;  // skip changes while saving;
    	}
        if (app.options.readOnly) {
            eventName = 'readOnly';
        }
        if (eventName == 'change') {
            app.dirty = true;
        } else if (eventName == 'sync') {
            app.dirty = false;
        }

        var msg = this.msgMap[eventName];
        this.$el.find('#save-status').text(msg);
        if (eventName == 'change' || eventName == 'error' || eventName == 'readOnly') {
            this.$el.find('#save-status').addClass('text-danger');
            this.$el.find('#save-status').addClass('font-weight-bold');
        } else {
            this.$el.find('#save-status').removeClass('text-danger');
            this.$el.find('#save-status').removeClass('font-weight-bold');
        }
    },

    tipMap : {
    	'edit': 'Shift click to delete stations, click & drag the blue dot to edit.',
        'add': 'Click to add stations to end.',
        'clear': 'Click and drag to pan map.'
    },
    updateTip: function(eventName) {
        var msg = this.tipMap[eventName];
        this.$el.find('#tip-status').text(msg);
    },

    refreshSaveAs: function(model, response) {
        var text = response.responseText;
        if (response.data != null) {
            var newId = response.data;
            if (newId != null) {
                document.location.href = newId;
            } else {
                app.vent.trigger('sync');
            }
        } else {
            app.vent.trigger('sync');
        }
    },

    handleVersionChange: function(model, response) {
        // update the plan id in case the version has changed
        var version = app.currentPlan.get('planVersion');
        if (!_.isUndefined(version)){
            app.currentPlan.set('planVersion', version.toUpperCase());
        } else {
            app.currentPlan.set('planVersion', 'A');
        }
        var planIdTemplate = app.planSchema.planIdFormat;
        var context = {
                plan: app.currentPlan.toJSON()
        };
        var planId = planIdTemplate.format(context);

        app.currentPlan.set('id', planId);
        app.currentPlan.get('sequence').resequence();
    },

    showSaveAsDialog: function() {
        $('#saveAsName').val(app.currentPlan.attributes['name']);
        var version = app.currentPlan.attributes['planVersion'];
        if (version != '') {
            var newVersion = String.fromCharCode(version.charCodeAt(0) + 1).toUpperCase();
        } else {
            var newVersion = 'A';
        }
        $('#saveAsVersion').val(newVersion);
        $('#saveAsNotes').val(app.currentPlan.attributes['notes']);
        $('#saveAsDialog').dialog({
            dialogClass: 'no-close',
            modal: false,
            resizable: true,
            closeOnEscape: true,
            buttons: {
                'Cancel': function() {
                    $(this).dialog('close');
                },
                'Save': function() {
                    var newName = $('#saveAsName').val();
                    var newVersion = $('#saveAsVersion').val();
                    var newNotes = $('#saveAsNotes').val();
                    app.currentPlan.set('planName', newName);
                    app.currentPlan.set('planVersion', newVersion);
                    app.currentPlan.set('name', newName);
                    app.currentPlan.set('notes', newNotes);
                    app.currentPlan.set('uuid', null);
                    app.currentPlan.save();
                    $(this).dialog('close');
                }
            },
            position: {
                my: 'right top',
                at: 'right bottom',
                of: '#tab-buttons'
            },
            dialogClass: 'saveAs'
        });
    }

});


app.views.PlanSequenceHeaderView = Marionette.View.extend({
	template: '#template-plan-sequence-header',
	templateContext: {stationMoniker: app.options.stationMoniker,
		segmentMoniker: app.options.segmentMoniker,
		stationMonikerPlural: app.options.stationMonikerPlural,
		segmentMonikerPlural: app.options.segmentMonikerPlural
	}
});

app.views.StationSequenceHeaderView = Marionette.View.extend({
    template: '#template-station-sequence-header',
    templateContext: function() {
    	return {stationMoniker: app.options.stationMoniker,
    		    label: this.model._sequenceLabel}
	}
});

app.views.SegmentSequenceHeaderView = Marionette.View.extend({
    template: '#template-segment-sequence-header',
    templateContext: function() {
    	return {stationMoniker: app.options.segmentMoniker,
    		    label: this.model._sequenceLabel}
	}
});

app.views.StationPropertiesHeaderView = Marionette.View.extend({
    template: '#template-station-properties-header',
    templateContext: {stationMoniker: app.options.stationMoniker}
});

app.views.SegmentPropertiesHeaderView = Marionette.View.extend({
    template: '#template-segment-properties-header',
    templateContext: {segmentMoniker: app.options.segmentMoniker}
});

app.views.CommandPropertiesHeaderView = Marionette.View.extend({
    template: '#template-command-properties-header',
    templateContext: function() {
    	return {commandMoniker: app.options.commandMoniker,
    		    label: this.model._commandLabel}
	}
});

app.views.CommandPresetsHeaderView = Marionette.View.extend({
    template: '#template-command-presets-header',
    templateContext: function() {
    	return {commandMoniker: app.options.commandMoniker,
    			commandMonikerPlural: app.options.commandMonikerPlural,
    		    label: this.model._commandLabel}
	}
});

app.views.PlanSequenceView = Marionette.View.extend({
    template: '#template-sequence-view',
    regions: {
        //Column Headings
        colhead1: '#colhead1',
        colhead2: '#colhead2',
        colhead3: '#colhead3',

        //Column content
        col1: '#col1',
        col2: {
            el: '#col2'
        },
        col3: {
            el: '#col3'
        }
    },

    initialize: function() {
        //this.listenTo(app.vent, 'showItem', this.showItem, this);
        this.listenTo(app.vent, 'showItem:station', this.showStation, this);
        this.listenTo(app.vent, 'showItem:segment', this.showSegment, this);
        this.listenTo(app.vent, 'showItem:command', this.showCommand, this);
        this.listenTo(app.vent, 'showMeta', this.showMeta, this);
        this.listenTo(app.vent, 'showPresets', this.showPresets, this);
        this.listenTo(app.vent, 'showNothing', this.showNothing, this);
        this.listenTo(app.vent, 'clearSelectedStation', this.clearColumns, this);
        this.listenTo(app.vent, 'updatePlan', this.rerender, this);
    },
    
    onBeforeDestroy: function(data) {
        this.stopListening(app.vent, 'showItem:station');
        this.stopListening(app.vent, 'showItem:segment');
        this.stopListening(app.vent, 'showItem:command');
        this.stopListening(app.vent, 'showMeta');
        this.stopListening(app.vent, 'showPresets');
        this.stopListening(app.vent, 'showNothing');
        this.stopListening(app.vent, 'clearSelectedStation');
	this.stopListening(app.vent, 'updatePlan');
    },

    onClose: function() {
        this.stopListening();
    },
    
    clearColumns: function() {
    	// Clears 2nd and 3rd columns
        this.getRegion('col2').empty();
        this.getRegion('col3').empty();
    },
    
    rerender: function() {
        this.getRegion('colhead1').empty();
        this.getRegion('col1').empty();
        this.showChildView('colhead1',new app.views.PlanSequenceHeaderView());
        this.showChildView('col1', new app.views.StationSequenceCollectionView({
            collection: app.currentPlan.get('sequence')
        }));
    },

    onRender: function() {
        app.psv = this;
        try {
            this.getRegion('colhead1').empty();
            this.getRegion('col1').empty();
            this.clearColumns();
        } catch (err) {
        }
        this.showChildView('colhead1', new app.views.PlanSequenceHeaderView());
        this.showChildView('col1', new app.views.StationSequenceCollectionView({
            collection: app.currentPlan.get('sequence')
        }));
    },
    
    showStation: function(itemModel) {
        // Clear columns
        try {
            this.getRegion('col3').empty();
            this.getRegion('colhead2').empty();
        } catch (ex) {
        }
        this.showChildView('colhead2', new app.views.StationSequenceHeaderView({
            model: itemModel
        }));
        this.getRegion('col2').empty(); 

        this.showChildView('col2', new app.views.CommandSequenceCollectionView({model: itemModel, collection: itemModel.get('commands')}));
    },

    showSegment: function(itemModel) {
        try {
            this.getRegion('col3').empty(); 
            this.getRegion('colhead2').empty(); 
        } catch (ex) {
        }
        this.showChildView('colhead2', new app.views.SegmentSequenceHeaderView({
            model: itemModel
        }));
        this.getRegion('col2').empty(); 

        this.showChildView('col2', new app.views.CommandSequenceCollectionView({model: itemModel, collection: itemModel.get('commands')}));

        this.showMeta(itemModel);
    },

    showCommand: function(itemModel) {
        try {
            this.getRegion('colhead3').empty();
        } catch (ex) {
        }
        this.showChildView('colhead3', new app.views.CommandPropertiesHeaderView({
            model: itemModel
        }));
        this.getRegion('col3').empty(); 
        
        this.showChildView('col3', new app.views.PropertiesForm({model: itemModel, readonly: app.options.readOnly}));
    },

    showMeta: function(model) {
        try {
            this.getRegion('colhead3').empty(); 
        } catch (ex) {
            
        }
        if (model.get('type') == 'Station') {
            var headerView = new app.views.StationPropertiesHeaderView();
        } else if (model.get('type') == 'Segment') {
            var headerView = new app.views.SegmentPropertiesHeaderView();
        } else if (model.get('type') == 'Command') {
            var headerView = new app.views.CommandPropertiesHeaderView();
        }
        this.showChildView('colhead3', headerView);
        this.getRegion('col3').empty();
        app.State.metaExpanded = true;
        app.State.addCommandsExpanded = false;
        app.State.commandSelected = undefined;
        this.showChildView('col3', new app.views.PropertiesForm({
            model: model
        }));
    },

    showPresets: function(itemModel) {
        try {
            this.getRegion('colhead3').empty(); 
        } catch (ex) {
        }
        this.showChildView('colhead3', new app.views.CommandPresetsHeaderView({model: itemModel}))
        this.getRegion('col3').empty(); 
        app.State.metaExpanded = false;
        app.State.addCommandsExpanded = true;
        app.State.commandSelected = undefined;
        this.showChildView('col3', new app.views.CommandPresetsView({
            model: itemModel
        }));
    },

    showNothing: function() {
        // clear the columns
        try {
            this.getRegion('col2').empty(); 
            this.getRegion('col3').empty(); 
            this.getRegion('colhead2').empty(); 
            this.getRegion('colhead3').empty(); 
        } catch (ex) {
            
        }
    }
});



app.views.SequenceListItemView = Marionette.View.extend({
    tagName: 'li',
    initialize: function(options) {
        this.options = options || {};
        xGDS.makeExpandable(this, this.options.expandClass);
    },
    template: '<span>{{modelstring}} <span class="duration">{{timing}}</span><i/></span>',
    templateContext: function() {
    	return  {modelstring: this.model.toString()};
    },
    attributes: function() {
    	try {
	        return {
	            'data-item-id': this.model.cid,
	            'class': this.model.get('type').toLowerCase() + '-sequence-item command-list'
	        };
    	} catch (err){
    		return {};
    	}
    },
    events: {
        click: function() {
            this.expand(this);
        }
    },
    modelEvents: {
        'change': 'render'
    }
});

app.views.PathElementItemView = app.views.SequenceListItemView.extend({
    events: {
        click: function() {
            app.State.metaExpanded = true;
            app.State.addCommandsExpanded = false;
            app.State.commandSelected = undefined;
            this.expand(this);
            var type = this.model.get('type'); // "Station" or "Segment"
            app.vent.trigger('showItem:' + type.toLowerCase(), this.model);
        }
    },
    onExpand: function() {
    },
    templateContext: function() {
    	var result = app.views.SequenceListItemView.prototype.templateContext.call(this);
    	if (this.model.get('type') == 'Station') {
            result['timing'] = app.util.secondsToHMS(this.model.getCumulativeDuration());
        } else {
            result['timing'] = '+' + app.util.secondsToHMS(this.model.getDuration());
        }
    	return result;
    }
});

app.views.NoStationsView = Marionette.View.extend({
    template: '#template-no-stations',
    templateContext:  {stationMoniker: app.options.stationMoniker,
            		   stationMonikerPlural: app.options.stationMonikerPlural}
});

app.views.StationSequenceCollectionView = Marionette.CollectionView.extend({
    tagName: 'ul',
    className: 'sequence-list station-list',
    childView: app.views.PathElementItemView,
    childViewOptions: {
        expandClass: 'col1'
    },
    emptyView: app.views.NoStationsView,
    initialize: function(options) {
        this.options = options || {};
        // re-render on plan save because for some reason, the collection
        // is re-rendered, reversed, on save.
        //app.State.stationSelected is our state variable
        this.listenTo(app.currentPlan, 'sync', this.render);
        this.listenTo(app.vent, 'station:change', this.render);
        this.listenTo(app.vent, 'station:remove', this.render);
        this.listenTo(app.vent, 'segment:remove', this.render);
        this.listenTo(app.vent, 'plan:reverse', this.render);
        this.on('childview:expand', function(childView) {this.onItemExpand(childView);}, this);
        //this.on('childview:render', this.restoreExpanded, this);
    },

    onItemExpand: function(childView) {
        app.State.stationSelected = childView.model;
        app.vent.trigger('itemSelected:station', childView.model);
    },

    restoreExpanded: function() {
        if (!_.isUndefined(app.State.stationSelected)) {
            var childView = this.children.findByModel(app.State.stationSelected);
            if (_.isUndefined(childView)) {
                // try to find the child view by ID since models change on save
                var childId = app.State.stationSelected.cid;
                var childModel = this.collection.get(childId);
                if (_.isUndefined(childModel)) {
                    // try to look it up by our id
                    childModel = this.collection.findWhere({id:app.State.stationSelected.get('id')});
                }
                if (_.isUndefined(childModel)) {
                    // can't find by id, so the view is gone
                    app.State.stationSelected = undefined;
                    app.vent.trigger('showNothing');
                } else {
                    childView = this.children.findByModel(childModel);
                    if (_.isUndefined(childView)) {
                        // the model isn't in our list, oh noes!
                        app.vent.trigger('showNothing');
                    } else {
                        app.State.stationSelected = childModel;
                        childView.expand(childView);
                        app.vent.trigger('showItem:' + childModel.get('type').toLowerCase(), childModel);
                    }
                }
            } else {
                // restore expanded state
                childView.expand(childView);
                app.vent.trigger('showItem:' + childView.model.get('type').toLowerCase(), childView.model);
            }
        } else if (!_.isUndefined(app.State.segmentSelected)) {
            var childView = this.children.findByModel(app.State.segmentSelected);
            if (_.isUndefined(childView)) {
                // try to find the child view by ID since models change on save
                var childId = app.State.segmentSelected.cid;
                var childModel = this.collection.get(childId);
                if (_.isUndefined(childModel)) {
                    // try to look it up by our id
                    childModel = this.collection.findWhere({id:app.State.segmentSelected.get('id')});
                }
                if (_.isUndefined(childModel)) {
                    // can't find by id, so the view is gone
                    app.State.segmentSelected = undefined;
                    app.vent.trigger('showNothing');
                } else {
                    childView = this.children.findByModel(childModel);
                    if (_.isUndefined(childView)) {
                        // the model isn't in our list, oh noes!
                        app.vent.trigger('showNothing');
                    } else {
                        app.State.segmentSelected = childModel;
                        childView.expand(childView);
                        app.vent.trigger('itemSelected:segment', this.model);
                        app.vent.trigger('showItem:' + childModel.get('type').toLowerCase(), childModel);
                    }
                }
            } else {
                // restore expanded state
                childView.expand(childView);
                app.vent.trigger('showItem:' + childView.model.get('type').toLowerCase(), childView.model);
            }
        }
    },

    onRender: function() {
        this.restoreExpanded();
    },

//    onClose: function() {
//        this.children.each(function(view) {
//            view.reset();
//        });
//    }

});

app.views.CommandItemView = app.views.SequenceListItemView.extend({
    template: function(data) {
        var displayName = data.name || data.presetName || data.presetCode;
        var timing = app.util.secondsToHMS(data.duration);
        return '<div class="form-check form-check-inline"><label class="form-check-label"><input class="form-check-input" type="checkbox" id="id_' + displayName + '">' + displayName +'</label><span class="duration">' + timing + '</span><i/></div>';
    },
    events: function() {
        return _.extend(app.views.SequenceListItemView.prototype.events, {
            'click input.form-check-input': this.toggleSelect,
            'click div label :checkbox': this.toggleSelect,
        });
    },
//    initialize: function(options) {
//        this.options = options || {};
//        app.views.SequenceListItemView.prototype.initialize.call(this);
//    },
    onRender: function() {
        this.$el.css('background-color', app.getColor(this.model.get('type')));
    },
    onExpand: function() {
        app.vent.trigger('showItem:command', this.model);
    },
    isSelected: function(evt) {
        return this.$el.find('input.form-check-input').is(':checked');
    },
    setSelected: function() {
        this.$el.find('input.form-check-input').prop('checked', true);
    },
    setUnselected: function() {
        this.$el.find('input.form-check-input').prop('checked', false);
    },
    toggleSelect: function(evt) {
        if (this.isSelected()) {
            this.trigger('selected');
        } else {
            this.trigger('unselected');
        }
        evt.stopPropagation();
    },
    onClose: function() {
        this.stopListening();
    }
});

app.views.MiscItemView = app.views.SequenceListItemView.extend({
    tagName: 'li',
    events: {},
    initialize: function(options) {
        this.options = options || {};
        if (this.options.extraClass) {
            this.className = this.className ? this.className + ' ' + this.options.extraClass : this.options.extraClass;
        }
        this.on('click', function() {this.trigger('expand', this, this.options.expandClass);}, this);
        if (this.options.click) {
            this.on('click', this.options.click, this);
        }
        xGDS.makeExpandable(this, this.options.expandClass);
    },
    templateContext: function() {
    	if (this.model.attributes.type == 'Station'){
    		var itemMoniker = app.options.stationMoniker;
    	} else {
    		var itemMoniker = app.options.segmentMoniker;
    	}

        return {
          commandMoniker: app.options.commandMoniker,
          commandMonikerPlural: app.options.commandMonikerPlural,
          itemMoniker: itemMoniker
        }
      },
      setUnselected: function() {
      }
});

app.views.NoCommandsView = Marionette.View.extend({
	template: '#template-no-commands',
	templateContext: {
		commandMoniker: app.options.commandMoniker,
		commandMonikerPlural: app.options.commandMonikerPlural
	},
	setUnselected: function() {
	}
});

app.views.CommandSequenceCollectionView = Marionette.TemplateCollectionView.extend({
    template: '#template-sequence-list-station',
    childrenEl: '.command-list',
    childView: app.views.CommandItemView,
    childViewOptions: {
        expandClass: 'col2'
    },
    emptyView: app.views.NoCommandsView,
    events: {
        'click #btn-copy': 'copySelectedCommands',
        'click #btn-paste': 'pasteCommands',
        'click #btn-cut': 'cutSelectedCommands',
        'click #btn-delete': 'deleteSelectedCommands',
        'click #btn-kill': 'killStation',
        'click .edit-meta': function(evt) {
            app.vent.trigger('showMeta', this.model);
        },
        'click .add-commands': function(evt) {
            app.vent.trigger('showPresets', this.model);
        },
        'sortstop': function(evt, ui) {
        	var newOrder = this.$childrenEl.sortable('toArray', {'attribute': 'data-item-id'});
            var oldOrder = this.model.get('commands').models.map(function(model) {
            	return model.cid;
            });
            if (JSON.stringify(newOrder) == JSON.stringify(oldOrder)){
                // no change in order
                return;
            }
            var commandModels = newOrder.map(function(cid) {
                return this.model.get('commands').filter(function(child) {
                	return child.cid == cid;
                })[0];
            }, this);
//            this.model.set('commands', commandModels);
            this.model.get('commands').models = commandModels;
            app.vent.trigger('change:plan');
        }
    },
    onAddChild: function() {
    	if (this.collection.length == 1){
    		this.$el.find("#commandButtonRow").show();
    	}
    },
    onRemoveChild: function(){
    	if (this.collection.length == 0){
    		this.$el.find("#commandButtonRow").hide();
    	}
    },
    initialize: function() {
    	if (this.model != undefined){
	    	this.model.attributes.commandMonikerPlural = app.options.commandMonikerPlural;
	    	if (this.model.attributes.type == 'Station'){
	    		this.model.attributes.itemMoniker = app.options.stationMoniker;
	    	} else {
	    		this.model.attributes.itemMoniker = app.options.segmentMoniker;
	    	}
    	}
        
        app.vent.reply('selectedCommands', this.getSelectedCommands, this);
        app.vent.reply('unselectAllCommands', this.unselectAll, this);
        app.vent.reply('currentPathElement', function() {return this.model;}, this);
        if (_.isUndefined(app.State.metaExpanded))
            app.State.metaExpanded = true;
        if (_.isUndefined(app.State.addCommandsExpanded))
            app.State.addCommandsExpanded = false;
        this.on('childview:expand', function(childView) {
        	this.onItemExpand(childView);
        }, this);
        this.on('childview:selected', this.onItemSelected, this);
        this.on('childview:unselected', this.onItemUnSelected, this);
        this.itemsSelected = false;
        this.listenTo(app.vent, 'commandsSelected', this.enableCommandActions);
        this.listenTo(app.vent, 'commandsUnSelected', this.disableCommandActions);
        this.listenTo(app.vent, 'updatePlanDuration', this.render);
    },
    templateContext: function() {
    	var canHaveCommands = app.canHaveCommands(this.model.attributes.type);
    	if (this.model.attributes.type == 'Station'){
    		var itemMoniker = app.options.stationMoniker;
    		var canDelete = true;
    	} else {
    		var itemMoniker = app.options.segmentMoniker;
    		var canDelete = false;
    	}
    	var duration = '';
    	if (this.model.get('type') == 'Station' || this.model.get('type') == 'Segment') {
            duration =  '+' + app.util.secondsToHMS(this.model.getDuration());
        }

    	return {
    		'duration': duration,
    		'stationMoniker': app.options.stationMoniker,
    		'commandMoniker': app.options.commandMoniker,
    		'commandMonikerPlural': app.options.commandMonikerPlural,
    		'itemMoniker': itemMoniker,
    		'canDelete': canDelete,
    		'canHaveCommands': canHaveCommands
    	};
    },
    onItemSelected: function() {
        if (this.itemsSelected) return;
        if (!_.isEmpty(this.getSelectedCommands())) {
            this.itemsSelected = true;
            app.vent.trigger('commandsSelected');
        }
    },

    onItemUnSelected: function() {
        if (!this.itemsSelected) return;
        if (_.isEmpty(this.getSelectedCommands())) {
            this.itemsSelected = false;
            app.vent.trigger('commandsUnSelected');
        }
    },

    getSelectedCommands: function() {
        var commands = [];
        this.children.each(function(childView) {
            try {
                if (childView.isSelected()) { commands.push(childView.model); }
            } catch(ex) {
                //pass
            }
            
        });
        return commands;
    },

    getCommandCollection: function() {
        return this.collection;
    },

    unselectAll: function() {
        if (!_.isEmpty(this.children)) {
            this.children.each(function(view) {
                if (!_.isUndefined(view)){
                    view.setUnselected();
                }
            });
        }
    },

    onItemExpand: function(childView) {
        app.State.commandSelected = childView.model;
        app.State.metaExpanded = false;
        app.State.addCommandsExpanded = false;
    },

    restoreExpanded: function() {
        //console.log('restoring closed view:', this.isClosed);
        if (app.State.metaExpanded) {
            app.vent.trigger('showMeta', this.model);
        } else if (app.State.addCommandsExpanded) {
            app.vent.trigger('showPresets', this.model);
        } else if (!_.isUndefined(app.State.commandSelected)) {
            var childView = this.children.findByModel(app.State.commandSelected);
            if (_.isUndefined(childView)) {
                // try to find the model by id
                var childId = app.State.commandSelected.cid;
                var childModel = this.collection.get(childId);
                if (_.isUndefined(childModel)) {
                    // can't find by id, so view is gone
                    app.vent.trigger('showMeta', this.model);
                } else {
                    childView = this.children.findByModel(childModel);
                    if (_.isUndefined(childView)) {
                        // the model isn't in our list, oh noes!
                        app.vent.trigger('showMeta', this.model);
                    } else {
                        app.State.commandSelected = childModel;
                        childView.expand(childView);
                        app.vent.trigger('showItem:command', childModel);
                    }
                }
            } else {
                // restore expanded state
                childView.expand(childView);
                app.vent.trigger('showItem:command', childView.model);
            }
        }
    },

    onRender: function() {
        
		if (this.collection.length > 0){
			this.$childrenEl.sortable();
		}
        this.restoreExpanded();
        if (!_.isEmpty(app.vent.request('selectedCommands'))) {
            this.enableCommandActions();
        } else {
            this.disableCommandActions();
        }
    },
    onClose: function() {
        this.children.each(function(view) {
            view.reset();
        });
        this.stopListening();
    },
    disableCommandActions: function() {
        this.$('#btn-copy').attr('disabled', 'true');
        if (!_.isEmpty(app.copiedCommands)){
            this.$('#btn-paste').removeAttr('disabled');
        } else {
            this.$('#btn-paste').attr('disabled', 'true');
        }
        this.$('#btn-cut').attr('disabled', 'true');
        this.$('#btn-delete').attr('disabled', 'true');
    },

    enableCommandActions: function() {
        this.$('#btn-copy').removeAttr('disabled');
        this.$('#btn-paste').removeAttr('disabled');
        this.$('#btn-cut').removeAttr('disabled');
        this.$('#btn-delete').removeAttr('disabled');
    },
    deleteSelectedCommands: function() {
        var commands = app.vent.request('selectedCommands');
        var selectParent = null;
        if (commands.length > 0){
            selectParent = commands[0].get('pathElement');
        }
        _.each(commands, function(command) {
            if (!_.isUndefined(command.collection)){
                command.collection.remove(command);
            }
            command.destroy();
        });
        app.vent.trigger('change:plan');
        if (selectParent != null){
            var showParent = 'showItem:' + selectParent.get('type').toLowerCase();
            app.vent.trigger(showParent, selectParent);
        }
    },
    
    killStation: function() {
    	if (!_.isUndefined(this.model) && this.model.get('type') == 'Station') {
    		var thePlan = this.model.get('plan');
    		var theSequence = thePlan.get('sequence');
    		var killedSegment = theSequence.removeStation(this.model);
    		app.vent.trigger('itemSelected:station', null);
    		app.vent.trigger('clearSelectedStation', null);
    	}
    },

    copySelectedCommands: function() {
        var commands = app.vent.request('selectedCommands');
        app.copiedCommands = new Array();
        app.copiedCommands.push.apply(app.copiedCommands, commands);
        //app.vent.request('unselectAllCommands');
    },

    pasteCommands: function() {
        var model = app.vent.request('currentPathElement');
        var commands = model.get('commands');
        var type = model.get('type');
        var cut = app.vent.request('cutAfterPaste');
        _.each(app.copiedCommands, function(command) {
        	commands.add(command.clone());
            //TODO now you can paste a command into a container that should not contain it. Verify permitted, or validate.
            /*
            if (cut) {
                commands.add(command.clone());
            } else if (command.get('pathElement').get('type') == type) {
                commands.add(command.clone());
            } */
            
        });
        app.vent.trigger('change:plan');
    },

    cutSelectedCommands: function() {
        var commands = app.vent.request('selectedCommands');
        if (commands.length > 0){
            app.copiedCommands = new Array();
            app.copiedCommands.push.apply(app.copiedCommands, commands);
            
            // remove them from the collection
            var selectParent = null;
            selectParent = commands[0].get('pathElement');
            _.each(commands, function(command) {
                if (!_.isUndefined(command.collection)){
                    command.collection.remove(command);
                }
            });
            app.vent.trigger('change:plan');
            if (selectParent != null){
                var showParent = 'showItem:' + selectParent.get('type').toLowerCase();
                app.vent.trigger(showParent, selectParent);
            }
            
//            app.vent.request('unselectAllCommands');
            app.vent.trigger('cutAfterPaste');
        }
    }
    
    
});

/*
** PropertiesForm is a hybrid between Marionette.View and Backbone.Form (from the backbone-forms extension).
** Becuase it extends Marionette.View, it can be used cleanly with a region manager.
**
** It has two other important properties:
** 1) It updates its model immediately in response to field value changes.
** 2) It can be made read-only
*/
app.views.PropertiesForm = Marionette.View.extend(Backbone.Form.prototype).extend({
    template: '#template-properties-form',

    events: {
        'change': 'commitCheck'
    },

    modelEvents: {
        'change': 'update'
    },

    initialize: function(options) {
        this.options = options || {};
        var readOnly = this.options.readOnly || app.options.readOnly;
        var visible = this.options.visible;

        // Construct a schema compatible with backbone-forms
        // https://github.com/powmedia/backbone-forms#schema-definition
        if (!_.isEmpty(this.options.model)){
            this.options.schema = this.options.schema || this.options.model.schema;
            this.options.data = this.options.data || this.options.model.data;
        }
        this.Field = Backbone.Form.UnitField;
        this.template = Handlebars.compile($(this.template).html());
        var schema = this.options.schema;

        if (readOnly) {
            _.each(schema, function(field, key) {
                field.editorAttrs = {
                    readonly: true,
                    disabled: true
                };
                schema[key] = field;
            });
        }
        Backbone.Form.prototype.initialize.call(this, this.options);
        
    },

    commitCheck: function() {
        Backbone.Form.prototype.commit.apply(this, arguments);
    },

    update: function() {
        var attrs = this.model.changedAttributes();
        _.each(_.keys(attrs), function(k) {
            var v = attrs[k];
            this.setValue(k, v);
        }, this);
    }
    
});

app.views.CommandPresetsView = Marionette.View.extend({
    template: '#template-command-presets',

    templateContext: function() {
        return {
            presets: app.getCommandPresets(this.model.get('type')),
            station: this.model.toJSON()
        };
    },

    events: {
        'click .add-preset': function(evt) {
            var pathElement = this.model;
            var target = $(evt.target);
            var preset = app.commandPresetsByName[target.data('preset-name')];
            app.Actions.disable();
            pathElement.appendCommandByPreset(preset);
            app.Actions.enable();
            app.vent.trigger('change:plan');
        }
    }
    
});


app.views.TabNavView = xGDS.TabNavView.extend({
    templateContext: {schedule: app.options.schedule},
    viewMap: {
        'meta': app.views.PropertiesForm,
        'sequence': app.views.PlanSequenceView,
        'layers': app.views.FancyTreeView,
        'search': app.views.SearchView,
        'tools': app.views.PlanToolsView,
        'links': app.views.PlanLinksView,
        'schedule': app.views.ScheduleView
    },

    initialize: function() {
    	xGDS.TabNavView.prototype.initialize.call(this);
        var context = this;
        this.listenTo(app.vent, 'onPlanLoaded', function() {
        	 this.setTab('meta');
        }, this);
    },
    getModel: function() {
    	return app.currentPlan;
    }

});


//TODO Sophie
/*
Construct a new ValidationTableView which will use the div below the tab view.
First step is to construct this marionette view and insert some html into the div using jquery. $el is I think the main element when you are inside your view, 
onAttach function is where you want to do the rendering stuff.  $el.append('<span>HELLO WORLD</span>');
try using template:undefined
When this initializes OR when an event is fired adding or removing a validation, the table will update with the validation contents.
You will need to set up a datatable to populate the table.
You will also need to write another recursive function in plannerApp to get a flat list of validations including their container
Once you are done building the view you can uncomment its construction in plannerApp.
*/
app.views.ValidationTableView = Marionette.View.extend({
	template: false,
	validationArray: undefined, //gets the validations
	tableElement: undefined,  //table we will pass to dataTables to use  
	initialize: function(){
		//TODO call plannerApp.getValidationAsList; this list is the data that goes in to the datatable
		this.listenTo(app.vent,'onPlanLoaded', this.initializeValidations);
		this.listenTo(app.vent,'validations:create', function(validationsArray){		
			this.constructDataTable(validationsArray); 
			});

		this.listenTo(app.vent, 'validation:remove',function(uuid){
			this.deleteMatchingRow(uuid);
		});

	},
	initializeValidations: function() {	
		if(app.currentPlan !==undefined){
			this.validationArray = app.getValidationsAsList(app.currentPlan, true, true);
			this.constructDataTable(this.validationArray);
			//this.initializeValidationTableData(this.validationArray);			
		}
	},
	constructDataTable: function(validationsArray){
		this.$el.html("<table id='validation_table'>" + "</table>"); //how to get real html from the template? 
		this.tableElement =	$('#validation_table').DataTable({
			data: validationsArray,
			select: true,
			columns: [
				{data: 'station', title: "Container"},
				{data: 'status', title: "Status"},
				{data: 'name', title: "Name"},
				{data: 'description', title: "Description"},
				{data: 'source', title: "Source"},
				{data: 'data',
				 title: "Data",
				 render: function(data, type, row){
					 var dataString = "";
					 var dataKeys = Object.keys(data);
					 for(var i=0; i<dataKeys.length; i++){
						 dataString += "\n" + dataKeys[i] +": "+data[dataKeys[i]];
					 }
					 return dataString;
				 }
				}
			],
			"createdRow": function(row, data, dataIndex){
				$(row).attr("id", validationsArray[dataIndex].uuid);
			}
		});	

			var myTable = this.tableElement;
			
			this.validationArray =  validationsArray;
			//return myTable;
	 },
	 /*Create a new method that takes the uuid as an argument and deletes the matching row*/
	 deleteMatchingRow: function(matchUuid){
		 //loop through the table rows
		 
		 var myTable = this.tableElement;
		 var myRow = myTable.row("#"+matchUuid).select();
		 myRow.remove().draw();
	 },
	initializeValidationTableData: function(validationsArray) {
		//TODO set the datatable's data from this.validationsArray
		if (validationsArray == undefined) {
		validationsArray =[];
		}
		this.constructDataTable(validationsArray);
	},
	updateValidationsRemove: function(validation){
		//TODO update the datatable with the attached validations
		var uuid = validation.uuid;
		this.deleteMatchingRow(uuid);
	},
	 onAttach: function(){
		this.tableElement = this.$el.find('#validation_table');
		console.log(this.tableElement);		
	}

});