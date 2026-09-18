package com.fincrimegraph.platform.web;

import com.fincrimegraph.platform.service.FinancialIntelligenceService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/intelligence")
public class FinancialIntelligenceController {

    private final FinancialIntelligenceService intelligenceService;

    public FinancialIntelligenceController(
            FinancialIntelligenceService intelligenceService
    ) {
        this.intelligenceService = intelligenceService;
    }

    @GetMapping("/customers")
    public List<
            FinancialIntelligenceService.CustomerSummary
            > customers(
            @RequestParam(required = false)
            String query
    ) {
        return intelligenceService.customers(
                query
        );
    }

    @GetMapping("/customers/{customerId}")
    public FinancialIntelligenceService.Customer360
    customer(
            @PathVariable UUID customerId
    ) {
        return intelligenceService.customer360(
                customerId
        );
    }

    @GetMapping("/accounts")
    public List<
            FinancialIntelligenceService.AccountSummary
            > accounts(
            @RequestParam(required = false)
            String query
    ) {
        return intelligenceService.accounts(
                query
        );
    }

    @GetMapping("/accounts/{accountId}")
    public FinancialIntelligenceService.Account360
    account(
            @PathVariable UUID accountId
    ) {
        return intelligenceService.account360(
                accountId
        );
    }

    @GetMapping("/transactions")
    public List<
            FinancialIntelligenceService.TransactionExplorerItem
            > transactions(
            @RequestParam(required = false)
            String query,

            @RequestParam(required = false)
            String channel,

            @RequestParam(required = false)
            String status,

            @RequestParam(required = false)
            BigDecimal minAmount,

            @RequestParam(required = false)
            BigDecimal maxAmount
    ) {
        return intelligenceService.transactions(
                query,
                channel,
                status,
                minAmount,
                maxAmount
        );
    }
}
