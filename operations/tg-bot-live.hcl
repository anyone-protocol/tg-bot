job "tg-bot-live" {
  datacenters = ["ator-fin"]
  type = "service"
  namespace = "ator-network"

  group "tg-bot-live-group" {
    count = 1

    network {
      mode = "bridge"
      port "http" {
        host_network = "wireguard"
        to = 80
      }
    }

    task "tg-bot-live-task" {
      driver = "docker"

      config {
        image = "ghcr.io/ator-development/tg-bot:[[.deploy]]"
      }

      logs {
        max_files     = 5
        max_file_size = 15
      }
	  
      vault {
        policies = ["tg-bot"]
      }

      template {
        data = <<EOH
        {{with secret "kv/tg-bot/live"}}
          BOT_TOKEN="{{.Data.data.BOT_TOKEN}}"
        {{end}}
        {{- range service "onionoo-jar-stage" }}
          API_URL="http://{{ .Address }}:{{ .Port }}/details"
        {{- end }}
        EOH
        destination = "secrets/file.env"
        env         = true
      }

      resources {
        cpu    = 1024
        memory = 2048
      }
    }
  }
}