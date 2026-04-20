'use strict';

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../lib/i18n';
import { Title, Toolbar } from '../lib/page';
import { useErrorHandling } from '../lib/hooks/useErrorHandling';
import { useRequiresAuthenticatedUser } from '../lib/hooks/useRequiresAuthenticatedUser';
import axios from '../lib/axios';
import { ReportState } from '../../../shared/reports';
import { getUrl } from "../lib/urls";
import { Button } from "../lib/bootstrap-components";
import PropTypes from "prop-types";

export default function ViewAndOutput({ viewType: viewTypeProp, match }) {
    useRequiresAuthenticatedUser();
    const { t } = useTranslation();
    const { handleError } = useErrorHandling();

    const [content, setContent] = useState(null);
    const [report, setReport] = useState(null);

    const reloadTimeoutHandlerRef = useRef(null);
    const reloadTimeoutIdRef = useRef(0);

    const viewTypes = {
        view: {
            url: 'rest/report-content',
            getTitle: name => t('reportName', { name }),
            loading: t('loadingReport'),
            finishedStates: new Set([ReportState.FINISHED]),
            getContent: content => <div dangerouslySetInnerHTML={{ __html: content }}/>
        },
        output: {
            url: 'rest/report-output',
            getTitle: name => t('outputForReportName', { name }),
            loading: t('loadingReportOutput'),
            finishedStates: new Set([ReportState.FINISHED, ReportState.FAILED]),
            getContent: content => <pre>{content}</pre>
        }
    };

    async function loadContent() {
        try {
            const id = parseInt(match.params.reportId);
            const contentRespPromise = axios.get(getUrl(viewTypes[viewTypeProp].url + '/' + id));
            const reportRespPromise = axios.get(getUrl(`rest/reports/${id}`));
            const [contentResp, reportResp] = await Promise.all([contentRespPromise, reportRespPromise]);

            setContent(contentResp.data);
            setReport(reportResp.data);

            const state = reportResp.data.state;

            if (state === ReportState.PROCESSING || state === ReportState.SCHEDULED) {
                if (reloadTimeoutHandlerRef.current) {
                    reloadTimeoutIdRef.current = setTimeout(reloadTimeoutHandlerRef.current, 1000);
                }
            }
        } catch (e) {
            handleError(e);
        }
    }

    useEffect(() => {
        reloadTimeoutHandlerRef.current = loadContent;
        loadContent();

        return () => {
            clearTimeout(reloadTimeoutIdRef.current);
            reloadTimeoutHandlerRef.current = null;
        };
    }, []);

    async function refresh() {
        try {
            const id = parseInt(match.params.reportId);
            await axios.post(getUrl(`rest/report-start/${id}`));
            loadContent();
        } catch (e) {
            handleError(e);
        }
    }

    const viewType = viewTypes[viewTypeProp];

    if (report) {
        let reportContent = null;

        if (viewType.finishedStates.has(report.state)) {
            reportContent = viewType.getContent(content);
        } else if (report.state === ReportState.SCHEDULED || report.state === ReportState.PROCESSING) {
            reportContent = <div className="alert alert-info" role="alert">{t('reportIsBeingGenerated')}</div>;
        } else {
            reportContent = <div className="alert alert-danger" role="alert">{t('reportNotGenerated')}</div>;
        }

        return (
            <div>
                <Toolbar>
                    <Button className="btn-primary" icon="repeat" label={t('refresh')} onClickAsync={(...args) => refresh(...args)}/>
                </Toolbar>

                <Title>{viewType.getTitle(report.name)}</Title>

                {reportContent}
            </div>
        );
    } else {
        return <div>{viewType.loading}</div>;
    }
}

ViewAndOutput.propTypes = {
    viewType: PropTypes.string.isRequired
};
