job "tg-bot-live" {
  datacenters = ["ator-fin"]
  type = "service"
  namespace = "live-services"

  group "tg-bot-live-group" {
    count = 1

    network {
      mode = "bridge"
      port "http" {
        host_network = "wireguard"
        to = 80
      }
    }

    volume "tg-bot-live" {
      type = "host"
      read_only = false
      source = "tg-bot-live"
    }

    task "tg-bot-live-task" {
      driver = "docker"

      config {
        image = "ghcr.io/anyone-protocol/tg-bot:[[.commit_sha]]"
        command = "node"
        args = ["index.js"]
      }

      volume_mount {
        volume = "tg-bot-live"
        destination = "/usr/src/app/data"
        read_only = false
      }

      logs {
        max_files     = 5
        max_file_size = 15
      }
	  
      vault {
        role = "any1-nomad-workloads-controller"
      }

      identity {
        name = "vault_default"
        aud  = ["any1-infra"]
        ttl  = "1h"
      }

      template {
        data = <<EOH
        {{with secret "kv/live-services/tg-bot-live"}}
          BOT_TOKEN="{{.Data.data.BOT_TOKEN}}"
        {{end}}
        EOH
        destination = "secrets/keys.env"
        env         = true
      }

      template {
        data = <<EOH
        {{- range service "onionoo-war-live" }}
          API_URL="http://{{ .Address }}:{{ .Port }}/details"
        {{- end }}
        EOH
        destination = "local/config.env"
        env         = true
      }

      resources {
        cpu    = 1024
        memory = 2048
      }
    }
  }
}