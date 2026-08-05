# OpenChamber Ingress add-on

This Home Assistant add-on places an existing OpenChamber installation behind authenticated Supervisor ingress. It lets the Home Assistant web and mobile apps reach OpenChamber through the same local or Nabu Casa connection they already use, without publishing OpenChamber directly to the internet.

The add-on is intentionally tailored to the existing OpenChamber service at `https://openchamber.jklocal.us`. It has no host port and accepts application traffic only from the Supervisor ingress proxy.

## Install

1. Add `https://github.com/jameskorzekwa/ha-openchamber-ingress` as a Home Assistant add-on repository.
2. Install and start **OpenChamber**.
3. Open the add-on from its **Open Web UI** button.

The first visit uses a separate browser origin from the direct LAN site, so sign in once with the existing OpenChamber password and select **Trust this device**.

See [DOCS.md](openchamber_ingress/DOCS.md) for operation and troubleshooting details.
