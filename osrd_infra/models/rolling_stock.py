from django.db import models
from django.contrib.postgres.fields import ArrayField
from django.utils.translation import gettext_lazy as _

from osrd_infra.utils import JSONSchemaValidator

EFFORT_CURVE_SCHEMA = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "speed": {"type": "number"},
            "max_effort": {"type": "number"},
        },
        "required": ["speed", "max_effort"],
    },
    "title": "schema",
}


EFFORT_CURVE_MAP_SCHEMA = {
    "type": "object",
    "additionalProperties": EFFORT_CURVE_SCHEMA,
}


ROLLING_RESISTANCE_SCHEMA = {
    "type": "object",
    "properties": {
        "type": {"const": "davis"},
        "A": {"type": "number", "minimum": 0},
        "B": {"type": "number", "minimum": 0},
        "C": {"type": "number", "minimum": 0},
    },
    "required": [
        "type",
        "A",
        "B",
        "C",
    ],
}


class RollingStock(models.Model):
    name = models.CharField(
        max_length=255,
        unique=True,
        help_text=_("A unique identifier for this rolling stock"),
    )

    owner = models.UUIDField(
        editable=False, default="00000000-0000-0000-0000-000000000000"
    )

    length = models.FloatField(
        help_text=_("The length of the train, in meters"),
    )

    mass = models.FloatField(help_text=_("The mass of the train, in kilograms"))

    inertia_coefficient = models.FloatField(
        help_text=_(
            "The inertia coefficient. It will be multiplied with the mass "
            "of the train to get its effective mass"
        ),
    )

    rolling_resistance = models.JSONField(
        help_text=_("The formula to use to compute rolling resistance"),
        validators=[JSONSchemaValidator(limit_value=ROLLING_RESISTANCE_SCHEMA)],
    )

    capabilities = ArrayField(
        models.CharField(max_length=255),
        help_text=_("A list of features the train exhibits, such as ERTMS support"),
    )

    max_speed = models.FloatField(
        help_text=_("The maximum operational speed, in m/s"),
    )

    startup_time = models.FloatField(
        help_text=_("The time the train takes before it can start accelerating"),
    )

    startup_acceleration = models.FloatField(
        help_text=_("The maximum acceleration during startup, in m/s^2"),
    )

    comfort_acceleration = models.FloatField(
        help_text=_("The maximum operational acceleration, in m/s^2"),
    )

    timetable_gamma = models.FloatField(
        help_text=_(
            "The maximum braking coefficient, for timetabling purposes, in m/s^2"
        ),
    )

    tractive_effort_curves = models.JSONField(
        help_text=_(
            "A set of curves mapping speed (in m/s) to maximum traction (in newtons)"
        ),
        validators=[JSONSchemaValidator(limit_value=EFFORT_CURVE_MAP_SCHEMA)],
    )

    traction_mode = models.CharField(max_length=128)

    power_class = models.PositiveIntegerField()

    image = models.ImageField(null=True, blank=True)

    def __str__(self):
        return self.name

    def to_railjson(self):
        return {
            "id": f"rolling_stock.{self.id}",
            "length": self.length,
            "mass": self.mass,
            "inertia_coefficient": self.inertia_coefficient,
            "rolling_resistance": self.rolling_resistance,
            "capabilities": self.capabilities,
            "max_speed": self.max_speed,
            "startup_time": self.startup_time,
            "startup_acceleration": self.startup_acceleration,
            "comfort_acceleration": self.comfort_acceleration,
            "gamma": self.timetable_gamma,
            "gamma_type": "CONST",
            "tractive_effort_curve": next(iter(self.tractive_effort_curves.values())),
        }
