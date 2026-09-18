package com.fincrimegraph.platform.service;

import com.fincrimegraph.platform.domain.CustomerEntity;
import com.fincrimegraph.platform.domain.TransactionEntity;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Service
public class TransactionRiskScoringService {

    private static final BigDecimal LARGE_AMOUNT = new BigDecimal("25000");
    private static final BigDecimal ELEVATED_AMOUNT = new BigDecimal("9000");

    public RiskAssessment assess(TransactionEntity transaction) {
        int score = 5;
        List<String> reasons = new ArrayList<>();

        if (transaction.getAmount().compareTo(LARGE_AMOUNT) >= 0) {
            score += 35;
            reasons.add("Large transaction amount");
        } else if (transaction.getAmount().compareTo(ELEVATED_AMOUNT) >= 0) {
            score += 20;
            reasons.add("Elevated transaction amount");
        }

        CustomerEntity sourceCustomer =
                transaction.getSourceAccount().getCustomer();

        CustomerEntity destinationCustomer =
                transaction.getDestinationAccount().getCustomer();

        if (sourceCustomer.getRiskTier() == CustomerEntity.RiskTier.HIGH) {
            score += 15;
            reasons.add("High-risk source customer");
        }

        if (destinationCustomer.getRiskTier() == CustomerEntity.RiskTier.HIGH) {
            score += 15;
            reasons.add("High-risk destination customer");
        }

        if (!sourceCustomer.getCountryCode()
                .equals(destinationCustomer.getCountryCode())) {
            score += 15;
            reasons.add("Cross-border relationship");
        }

        if (transaction.getChannel()
                == TransactionEntity.TransactionChannel.WIRE) {
            score += 10;
            reasons.add("Wire transfer");
        }

        score = Math.min(score, 100);

        return new RiskAssessment(score, List.copyOf(reasons));
    }

    public record RiskAssessment(
            int score,
            List<String> reasons
    ) {
    }
}
