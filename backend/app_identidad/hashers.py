"""Hashers de contraseña de Heimdall.

Scrypt es memory-hard y ofrece una buena relación seguridad/tiempo. El hasher
de Django usa ``parallelism=5`` por defecto; en este proyecto la verificación
en hardware modesto (portátiles de portería) tarda ~350-400 ms por login. Con
``parallelism=1`` se mantiene el coste de memoria (N=2^14, r=8) y se reduce el
tiempo de verificación a ~100 ms, que es el cuello de botella real del login.

Los hashes antiguos con ``parallelism=5`` se migran automáticamente en el
primer login exitoso gracias a ``verify_password`` + ``must_update``.
"""

from django.contrib.auth.hashers import ScryptPasswordHasher


class HeimdallScryptPasswordHasher(ScryptPasswordHasher):
    """Scrypt con paralelismo 1 para logins rápidos en equipos de portería."""

    parallelism = 1
