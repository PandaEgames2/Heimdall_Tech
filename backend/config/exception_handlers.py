from rest_framework.views import exception_handler


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        payload = {
            "error": True,
            "message": response.data,
        }
        response.data = payload
    return response
