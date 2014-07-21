# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from django import forms
from django.conf import settings
from xgds_planner2.models import getPlanSchema


class CreatePlanForm(forms.Form):
    planNumber = forms.IntegerField(label='Plan number')
    planVersion = forms.CharField(label='Plan version', max_length=1, initial='A')
    platform = forms.ChoiceField(choices=[], required=True)
    site = forms.ChoiceField(choices=[], required=False)

    def __init__(self, *args, **kwargs):
        super(CreatePlanForm, self).__init__(*args, **kwargs)
        platforms = sorted(settings.XGDS_PLANNER_SCHEMAS.keys())
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
