"""Features included in the three published Heimdall plans."""


def features_for_establecimiento(establecimiento):
    plan = getattr(establecimiento, "id_plan", None)
    plan_id = getattr(plan, "id_plan", None)
    permite_ia = bool(getattr(plan, "permite_ia", False))

    # The product tiers in Heimdall_Tech.sql are cumulative: Manual + QR,
    # then RFID, then LPR/IA. Unknown plans get the safe manual baseline.
    return {
        "manual": True,
        "qr": plan_id in (1, 2, 3),
        "rfid": plan_id in (2, 3),
        "lpr": permite_ia,
    }
