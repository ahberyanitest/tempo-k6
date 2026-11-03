package dev.tempo.gateway;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.context.annotation.Bean;

import reactor.core.publisher.SignalType;

@SpringBootApplication
public class GatewayApplication {
    private static final Logger logger = LoggerFactory.getLogger(GatewayApplication.class);

    public static void main(String[] args) {
        SpringApplication.run(GatewayApplication.class, args);
    }

    @Bean
    GlobalFilter requestLoggingFilter() {
        return (exchange, chain) -> chain.filter(exchange)
                .doFinally(signalType -> {
                    if (signalType == SignalType.ON_COMPLETE) {
                        logger.info("Handled gateway request");
                    }
                });
    }
}
