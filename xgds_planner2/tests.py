#__BEGIN_LICENSE__
# Copyright (c) 2015, United States Government, as represented by the
# Administrator of the National Aeronautics and Space Administration.
# All rights reserved.
#
# The xGDS platform is licensed under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# http://www.apache.org/licenses/LICENSE-2.0.
#
# Unless required by applicable law or agreed to in writing, software distributed
# under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
# CONDITIONS OF ANY KIND, either express or implied. See the License for the
# specific language governing permissions and limitations under the License.
#__END_LICENSE__

from django.test import TestCase
from django.test.utils import override_settings
from django.core.urlresolvers import reverse
from django.conf import settings
from unittest import skipIf

from xgds_planner2 import models

import logging


@override_settings(PIPELINE_ENABLED=False)
class xgds_planner2Test(TestCase):
    """
    Right now for this to work it REQUIRES the test schema to exist in the siteSettings, and it to have been prepped.
    TODO: make this not a requirement, and instead have setup and teardown methods here in this test that will do what we need, including prep and destroy.
    """
    fixtures = ['xgds_planner2_testing.json',
                'xgds_planner2_testing_auth.json']
    test_plan_data = {"planNumber": 1,
                      "planVersion": "A",
                      "platform": "test"}
    login_info = {'username': 'vagrant',
                  'password': 'vagrant'}

    def setUp(self):
        logging.disable(logging.WARNING)

    @skipIf(getattr(settings, 'XGDS_PLANNER2_TEST_SKIP_INDEX',
                    settings.XGDS_PLANNER2_TEST_SKIP_INDEX),
            "index test set to be skipped")
    def test_index(self):
        response = self.client.get(reverse('planner2_index'))
        self.assertEquals(response.status_code, 200)

    @skipIf(getattr(settings, 'XGDS_PLANNER2_TEST_SKIP_EDIT',
                    settings.XGDS_PLANNER2_TEST_SKIP_EDIT),
            'edit test set to be skipped')
    def test_edit(self):
        self.client.login(**self.login_info)
        response = self.client.get(reverse('planner2_edit', args=['1']))
        self.assertEquals(response.status_code, 200)

    @skipIf(getattr(settings, 'XGDS_PLANNER2_TEST_SKIP_DOC',
                    settings.XGDS_PLANNER2_TEST_SKIP_DOC),
            'doc test set to be skipped')
    def test_doc(self):
        response = self.client.get(reverse('planner2_doc', args=['1']))
        self.assertEquals(response.status_code, 200)

    @skipIf(getattr(settings, 'XGDS_PLANNER2_TEST_SKIP_PLAN_REST',
                    settings.XGDS_PLANNER2_TEST_SKIP_PLAN_REST),
            'plan rest test set to be skipped')
    def test_plan_save_json(self):
        self.client.login(**self.login_info)
        response = self.client.get(reverse('planner2_plan_save_json', args=['1', 'test']))
        self.assertEquals(response.status_code, 200)

    @skipIf(getattr(settings, 'XGDS_PLANNER2_TEST_SKIP_PLAN_EXPORT',
                    settings.XGDS_PLANNER2_TEST_SKIP_PLAN_EXPORT),
            'plan export test set to be skipped')
    def test_plan_export(self):
        response = self.client.get(reverse('planner2_planExport',
                                           args=['421d0eb5-f04d-4f36-a4f7-503e0ca8ef2e', 'test.kml']),
                                   follow=True)
        self.assertEquals(response.status_code, 200)

    @skipIf(getattr(settings, 'XGDS_PLANNER2_TEST_SKIP_CREATE_PLAN_PAGE',
                    settings.XGDS_PLANNER2_TEST_SKIP_CREATE_PLAN_PAGE),
            'plan create page test set to be skipped')
    def test_create_plan_page(self):
        self.client.login(**self.login_info)
        response = self.client.get(reverse('planner2_planCreate'))
        self.assertEquals(response.status_code, 200)

    @skipIf(getattr(settings, 'XGDS_PLANNER2_TEST_SKIP_CREATE_PLAN',
                    settings.XGDS_PLANNER2_TEST_SKIP_CREATE_PLAN),
            'create plan test set to be skipped')
    def test_create_plan(self):
        self.client.login(**self.login_info)
        response = self.client.post(reverse('planner2_planCreate'), self.test_plan_data)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(len(models.Plan.objects.all()), 2)
