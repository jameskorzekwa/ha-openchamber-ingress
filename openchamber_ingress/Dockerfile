ARG BUILD_ARCH
FROM ghcr.io/home-assistant/${BUILD_ARCH}-base:3.24-2026.06.1

LABEL org.opencontainers.image.title="Home Assistant OpenChamber Ingress add-on" \
      org.opencontainers.image.description="Authenticated Home Assistant ingress proxy for OpenChamber" \
      org.opencontainers.image.source="https://github.com/jameskorzekwa/ha-openchamber-ingress" \
      org.opencontainers.image.licenses="MIT"

RUN apk add --no-cache ca-certificates nginx

COPY rootfs /

RUN chmod 0755 /etc/s6-overlay/s6-rc.d/openchamber-ingress/run
