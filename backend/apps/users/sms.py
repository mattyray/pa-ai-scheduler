import boto3
import os
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class SMSService:
    def __init__(self):
        self.client = boto3.client(
            'sns',
            region_name=getattr(settings, 'AWS_SNS_REGION', 'us-east-2'),
            aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY'),
        )
    
    def send_sms(self, phone_number, message):
        """
        Send SMS via AWS SNS.
        
        Args:
            phone_number: E.164 format (+15551234567)
            message: SMS text (keep under 160 chars to avoid splitting)
        
        Returns:
            bool: True if sent successfully, False otherwise
        """
        if not phone_number:
            logger.warning('SMS send attempted with no phone number')
            return False
        
        if not phone_number.startswith('+'):
            logger.warning(f'SMS send attempted with invalid phone format: {phone_number}')
            return False
        
        try:
            response = self.client.publish(
                PhoneNumber=phone_number,
                Message=message,
                MessageAttributes={
                    'AWS.SNS.SMS.SMSType': {
                        'DataType': 'String',
                        'StringValue': 'Transactional'
                    }
                }
            )
            logger.info(f'SMS sent to {phone_number}: MessageId={response["MessageId"]}')
            return True
        except Exception as e:
            logger.error(f'SMS send failed to {phone_number}: {str(e)}')
            return False


sms_service = SMSService()


def send_sms(phone_number, message):
    """Convenience function for sending SMS"""
    return sms_service.send_sms(phone_number, message)


