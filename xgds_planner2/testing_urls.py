from django.conf.urls import patterns, include

urlpatterns = patterns(
    '',

    (r'^xgds_planner2/', include('xgds_planner2.urls')),
)
