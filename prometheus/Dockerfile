FROM prom/prometheus:v2.48.0

USER root
COPY prometheus.yml /etc/prometheus/prometheus.yml
COPY alert_rules.yml /etc/prometheus/alert_rules.yml
RUN chmod 644 /etc/prometheus/prometheus.yml /etc/prometheus/alert_rules.yml && \
    mkdir -p /prometheus && chmod 777 /prometheus
USER nobody

EXPOSE 9090

ENTRYPOINT ["sh", "-c", "prometheus --config.file=/etc/prometheus/prometheus.yml --storage.tsdb.path=/prometheus --web.enable-lifecycle"]
