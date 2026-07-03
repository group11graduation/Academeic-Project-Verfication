FROM python:3.12-slim

ENV JUPYTER_PORT=8888

WORKDIR /workspace

RUN pip install --no-cache-dir notebook jupyter

COPY entrypoint.sh /preview-entrypoint.sh
RUN sed -i 's/\r$//' /preview-entrypoint.sh && chmod +x /preview-entrypoint.sh

EXPOSE 8888
ENTRYPOINT ["/preview-entrypoint.sh"]
