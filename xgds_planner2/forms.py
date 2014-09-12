# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__
import datetime
from django import forms
from django.conf import settings
from geocamUtil.loader import getModelByName
from xgds_planner2 import settings
from xgds_planner2.models import getPlanSchema


class CreatePlanForm(forms.Form):
    planNumber = forms.IntegerField(label='Plan number')
    planVersion = forms.CharField(label='Plan version', max_length=1, initial='A')
    platform = forms.ChoiceField(choices=[], required=True)
    site = forms.ChoiceField(choices=[], required=False)

    def __init__(self, *args, **kwargs):
        super(CreatePlanForm, self).__init__(*args, **kwargs)
        platforms = sorted(settings.XGDS_PLANNER_SCHEMAS.keys())
        try:
            platforms.remove("test")
        except ValueError:
            pass
        self.fields['platform'].choices = [(p, p) for p in platforms]

        # TODO right now this shows an alphabetically sorted list of all the sites together.
        # really what we want is to change the sites based on the chosen platform.
        allSites = []
        for platform in platforms:
            schema = getPlanSchema(platform)
            library = schema.getLibrary()
            sites = library.sites
            if sites:
                for site in sites:
                    allSites.append(site)
        sites = sorted(allSites, key=lambda site: site.name)
        self.fields['site'].choices = [(site.id, site.name) for site in sites]


# form for creating a flight group, flights, and all sorts of other stuff needed for our overly complex system.
class GroupFlightForm(forms.Form):
    year = None
    month = None
    day = None
    date = forms.DateField(required=True)
    prefix = forms.CharField(widget=forms.TextInput(attrs={'size': 4}),
                             label="Prefix",
                             required=True,
                             initial='A')

    CHOICES = []
    VehicleModel = getModelByName(settings.XGDS_PLANNER2_VEHICLE_MODEL)
    for vehicle in VehicleModel.objects.all().order_by('name'):
        CHOICES.append((vehicle.name, vehicle.name))

    if len(CHOICES) == 1:
        initial = [c[0] for c in CHOICES]
    else:
        initial = None
    vehicles = forms.MultipleChoiceField(choices=CHOICES, widget=forms.CheckboxSelectMultiple(), required=False, initial=initial)

    notes = forms.CharField(widget=forms.TextInput(attrs={'size': 128}), label="Notes", required=False)

    def initialize(self, timeinfo):
        self.year = timeinfo['year']
        self.month = timeinfo['month']
        self.day = timeinfo['day']
        self.date = datetime.date(int(self.year), int(self.month), int(self.day))
        self.month = int(timeinfo['month']) - 1  # apparently 0 is january
