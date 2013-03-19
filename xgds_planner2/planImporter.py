# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

import os
import datetime

from xgds_planner2 import models, xpjson


class PlanImporter(object):
    """
    Abstract class that defines the API for plan importers.
    """

    label = 'Describe the type of file the class imports. Set in subclasses.'

    def importPlanFromPath(self, path, meta, schema):
        f = open(path, 'rb')
        return self.importPlanFromStream(f, meta, schema)

    def importPlanFromStream(self, stream, meta, schema):
        return self.importPlanFromBuffer(stream.read(), meta, schema)

    def importPlanFromBuffer(self, buf, meta, schema):
        raise NotImplementedError()
