FROM alpine:3.22 AS engine
RUN wget -q https://github.com/motis-project/motis/releases/download/v2.11.3/motis-linux-amd64.tar.bz2 -O /tmp/motis.tar.bz2 && tar xjf /tmp/motis.tar.bz2 -C / && rm /tmp/motis.tar.bz2
FROM node:24-alpine
WORKDIR /app
COPY routing-gateway/package*.json ./
RUN npm ci --omit=dev
COPY routing-gateway/datasets.mjs ./
COPY motis/poc.mjs ./
COPY motis/engine-bootstrap.mjs ./
COPY --from=engine /motis /motis
ENV PORT=8080 DATA_DIR=/data
EXPOSE 8080
CMD ["node","engine-bootstrap.mjs"]
