package com.st6.cadence.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class SecurityConfig {

  @Value("${cadence.security.permit-all:false}")
  private boolean permitAll;

  @Bean
  SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    http.cors(Customizer.withDefaults()).csrf((csrf) -> csrf.disable());

    if (permitAll) {
      http.authorizeHttpRequests((authorize) -> authorize.anyRequest().permitAll());
    } else {
      http.authorizeHttpRequests(
              (authorize) ->
                  authorize
                      .requestMatchers("/actuator/health")
                      .permitAll()
                      .anyRequest()
                      .authenticated())
          .oauth2ResourceServer((oauth2) -> oauth2.jwt(Customizer.withDefaults()));
    }

    return http.build();
  }

  @Bean
  CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration configuration = new CorsConfiguration();
    configuration.addAllowedOriginPattern("http://localhost:*");
    configuration.addAllowedHeader("*");
    configuration.addAllowedMethod("*");

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", configuration);
    return source;
  }
}
