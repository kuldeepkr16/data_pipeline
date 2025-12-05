FROM minio/minio:latest

# Expose MinIO ports
EXPOSE 9000
EXPOSE 9001

# Command to run MinIO server
CMD ["server", "/data", "--console-address", ":9001"]

