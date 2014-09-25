# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

# from django.contrib import admin
# import xgds_planner2.models

# this is now an abstract class so if you want it in the admin tool you should register your derived class
# admin.site.register(xgds_planner2.models.Plan)

from django.contrib import admin
from xgds_planner2.models import *  # pylint: disable=W0401

admin.site.register(ActiveFlight)
admin.site.register(Plan)
