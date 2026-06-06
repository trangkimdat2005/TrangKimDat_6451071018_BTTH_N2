FROM prom/alertmanager:v0.27.0

USER root
COPY alertmanager.yml /etc/alertmanager/alertmanager.yml
RUN chmod 644 /etc/alertmanager/alertmanager.yml
USER nobody

EXPOSE 9093

ENTRYPOINT ["sh", "-c", "alertmanager --config.file=/etc/alertmanager/alertmanager.yml --web.listen-address=:9093"]
