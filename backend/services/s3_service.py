import os
import time
import hmac
import hashlib
import shutil
from pathlib import Path
import boto3
from botocore.exceptions import ClientError
from config import settings

class StorageService:
    def __init__(self):
        self.use_s3 = bool(
            settings.AWS_ACCESS_KEY_ID and 
            settings.AWS_SECRET_ACCESS_KEY and 
            settings.S3_BUCKET_NAME
        )
        if self.use_s3:
            self.s3_client = boto3.client(
                "s3",
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_REGION
            )
            self.bucket_name = settings.S3_BUCKET_NAME
        else:
            self.s3_client = None
            self.bucket_name = None

    def upload_file(self, local_path: str, s3_key: str) -> str:
        """
        Uploads a file. If S3 is active, uploads to S3 bucket.
        Otherwise, copies to the local media directory.
        Returns the key/path identifier.
        """
        if self.use_s3:
            try:
                self.s3_client.upload_file(local_path, self.bucket_name, s3_key)
                return s3_key
            except ClientError as e:
                print(f"S3 Upload failed: {e}. Falling back to local storage.")
                # Fall through to local storage if S3 fails
        
        # Local Fallback
        dest_path = settings.MEDIA_DIR / s3_key
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        
        # If local_path is already where we want it to be, do nothing
        if Path(local_path).resolve() != dest_path.resolve():
            shutil.copy2(local_path, dest_path)
            
        return s3_key

    def get_presigned_url(self, s3_key: str, expires_in: int = 604800) -> str:
        """
        Generates a pre-signed URL (valid for expires_in seconds, default 7 days).
        If S3 is active, returns S3 presigned URL.
        Otherwise, returns a cryptographically signed local URL.
        """
        if self.use_s3:
            try:
                url = self.s3_client.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": self.bucket_name, "Key": s3_key},
                    ExpiresIn=expires_in
                )
                return url
            except ClientError as e:
                print(f"Error generating S3 presigned URL: {e}. Falling back to local.")
        
        # Local Signed URL Fallback
        # Key contains 'videos/filename.mp4' or 'violations/filename.jpg'
        expires_at = int(time.time()) + expires_in
        
        # Generate signature: HMAC-SHA256 of "key:expires_at" using the signing key
        message = f"{s3_key}:{expires_at}".encode("utf-8")
        signature = hmac.new(
            settings.LOCAL_URL_SIGNING_KEY.encode("utf-8"),
            message,
            hashlib.sha256
        ).hexdigest()
        
        # For simplicity, we assume localhost:8000 in local mode.
        # This will be routed through the FastAPI media endpoint.
        # Ensure s3_key is clean (no double slashes)
        clean_key = s3_key.replace("\\", "/")
        base_url = os.getenv("BACKEND_URL", "http://localhost:8000")
        return f"{base_url}/media/{clean_key}?expires={expires_at}&signature={signature}"

    def verify_local_url(self, s3_key: str, expires_at: int, signature: str) -> bool:
        """
        Verifies that a local URL has not expired and that the signature is valid.
        """
        if int(time.time()) > expires_at:
            return False
            
        message = f"{s3_key}:{expires_at}".encode("utf-8")
        expected_signature = hmac.new(
            settings.LOCAL_URL_SIGNING_KEY.encode("utf-8"),
            message,
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(expected_signature, signature)

storage_service = StorageService()
