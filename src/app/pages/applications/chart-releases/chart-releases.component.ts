import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { DialogService, SystemGeneralService } from '../../../services/index';
import { ApplicationsService } from '../applications.service';
import { ModalService } from '../../../services/modal.service';
import { EntityJobComponent } from '../../common/entity/entity-job/entity-job.component';
import { EntityUtils } from '../../common/entity/utils';
import { DialogFormConfiguration } from '../../common/entity/entity-dialog/dialog-form-configuration.interface';
import { ChartReleaseEditComponent } from '../forms/chart-release-edit.component';
import { PlexFormComponent } from '../forms/plex-form.component';
import { NextCloudFormComponent } from '../forms/nextcloud-form.component';
import { MinioFormComponent } from '../forms/minio-form.component';

import  helptext  from '../../../helptext/apps/apps';

@Component({
  selector: 'app-charts',
  templateUrl: './chart-releases.component.html',
  styleUrls: ['../applications.component.scss']
})
export class ChartReleasesComponent implements OnInit {
  public chartItems = [];
  private dialogRef: any;
  public tempIcon = 'assets/images/ix-original.png';
  public plexIcon = 'https://www.plex.tv/wp-content/uploads/2018/01/pmp-icon-1.png';
  public nextcloudIcon = 'https://cdn.rawgit.com/docker-library/docs/defa5ffc7123177acd60ddef6e16bddf694cc35f/nextcloud/logo.svg';
  public minioIcon = 'https://min.io/resources/img/logo/MINIO_wordmark.png';
  private rollbackChartName: string;
  private chartReleaseForm: ChartReleaseEditComponent;
  private plexForm: PlexFormComponent;
  private nextCloudForm: NextCloudFormComponent;
  private minioForm: MinioFormComponent;
  private refreshTable: Subscription;
  private refreshForm: Subscription;

  public rollBackChart: DialogFormConfiguration = {
    title: helptext.charts.rollback_dialog.title,
    fieldConfig: [{
      type: 'input',
      name: 'item_version',
      placeholder: helptext.charts.rollback_dialog.version.placeholder,
      tooltip: helptext.charts.rollback_dialog.version.tooltip,
      required: true
    },{
      type: 'checkbox',
      name: 'rollback_snapshot',
      placeholder: helptext.charts.rollback_dialog.snapshot.placeholder,
      tooltip: helptext.charts.rollback_dialog.snapshot.tooltip
    },{
      type: 'checkbox',
      name: 'force',
      placeholder: helptext.charts.rollback_dialog.force.placeholder,
      tooltip: helptext.charts.rollback_dialog.force.tooltip
    }],
    method_ws: 'chart.release.rollback',
    saveButtonText: helptext.charts.rollback_dialog.action,
    customSubmit: this.doRollback,
    parent: this,
  }

  constructor(private mdDialog: MatDialog,
    private dialogService: DialogService, private translate: TranslateService,
    private appService: ApplicationsService, private modalService: ModalService,
    private sysGeneralService: SystemGeneralService) { }

  ngOnInit(): void {
    this.refreshChartReleases();
    this.refreshForms();
    this.refreshTable = this.modalService.refreshTable$.subscribe(() => {
      this.refreshChartReleases();
    })
    this.refreshForm = this.modalService.refreshForm$.subscribe(() => {
      this.refreshForms();
    });
  }

  refreshForms() {
    this.chartReleaseForm = new ChartReleaseEditComponent(this.mdDialog,this.dialogService,this.modalService,this.appService);
    this.plexForm = new PlexFormComponent(this.mdDialog,this.dialogService,this.modalService,this.sysGeneralService);
    this.nextCloudForm = new NextCloudFormComponent(this.mdDialog,this.dialogService,this.modalService,this.appService);
    this.minioForm = new MinioFormComponent(this.mdDialog,this.dialogService,this.modalService);
  }

  refreshChartReleases() {
    this.appService.getChartReleases().subscribe(charts => {
      this.chartItems = [];
      let repos = [];
      let iconPath = this.tempIcon;
      charts.forEach(chart => {
        switch(chart.chart_metadata.name) {
          case 'plex':
            iconPath = this.plexIcon;
            break;
          case 'nextcloud':
            iconPath = this.nextcloudIcon;
            break;
          case 'minio':
            iconPath = this.minioIcon;
            break;
          
          default:
            iconPath = this.tempIcon;
        }
        let chartObj = {
          name: chart.name,
          catalog: chart.catalog,
          status: chart.status,
          version: chart.chart_metadata.version,
          description: chart.chart_metadata.description,
          update: chart.update_available,
          chart_name: chart.chart_metadata.name,
          repository: chart.config.image.repository,
          tag: chart.config.image.tag,
          portal: chart.portals && chart.portals.web_portal ? chart.portals.web_portal[0] : '',
          id: chart.chart_metadata.name,
          icon: iconPath,
          count: `${chart.pod_status.available}/${chart.pod_status.desired}`,
          desired: chart.pod_status.desired,

        };
        repos.push(chartObj.repository);
        let ports = [];
        if (chart.used_ports) {
          chart.used_ports.forEach(item => {
            ports.push(`${item.port}\\${item.protocol}`)
          })
          chartObj['used_ports'] = ports.join(', ');
          this.chartItems.push(chartObj);
        }       
      })
    })
  }

  refreshStatus(name: string) {
    this.appService.getChartReleases(name).subscribe(res => {
      let item = this.chartItems.find(o => o.name === name);
      item.status = res[0].status;
      if (item.status === 'DEPLOYING') {
        setTimeout(() => {
          this.refreshStatus(name);
        }, 3000);
      }
    })
  }

  start(name: string) {
    this.appService.setReplicaCount(name, 1).subscribe(() => {
      this.refreshStatus(name);
    })
  }

  stop(name: string) {
    this.appService.setReplicaCount(name, 0).subscribe(() => {
      this.refreshStatus(name);
    })
  }

  portal(portal: string) {
    window.open(portal);
  }

  update(name: string) {
    this.translate.get(helptext.charts.update_dialog.msg).subscribe(msg => {
      this.dialogService.confirm(helptext.charts.update_dialog.title, msg + name + '?')
      .subscribe(res => {
        if (res) {
          this.dialogRef = this.mdDialog.open(EntityJobComponent, { data: { 'title': (
            helptext.charts.update_dialog.job) }, disableClose: true});
          this.dialogRef.componentInstance.setCall('chart.release.upgrade', [name]);
          this.dialogRef.componentInstance.submit();
          this.dialogRef.componentInstance.success.subscribe((res) => {
            this.dialogService.closeAllDialogs();
          });
          this.dialogRef.componentInstance.failure.subscribe((err) => {
            // new EntityUtils().handleWSError(this, err, this.dialogService);
          })
        }
      })
    })
  }

  rollback(name: string) {
    this.rollbackChartName = name;
    this.dialogService.dialogForm(this.rollBackChart, true);
  }

  doRollback(entityDialog: any) {
    const self = entityDialog.parent;
    const form = entityDialog.formGroup.controls;
    const payload = {
      item_version: form['item_version'].value,
      rollback_snapshot: form['rollback_snapshot'].value,
      force: form['force'].value
    }
    self.dialogRef = self.mdDialog.open(EntityJobComponent, { data: { 'title': (
      helptext.charts.rollback_dialog.job) }, disableClose: true});
    self.dialogRef.componentInstance.setCall('chart.release.rollback', [self.rollbackChartName, payload]);
    self.dialogRef.componentInstance.submit();
    self.dialogRef.componentInstance.success.subscribe((res) => {
      self.dialogService.closeAllDialogs();
    });
    self.dialogRef.componentInstance.failure.subscribe((err) => {
      // new EntityUtils().handleWSError(self, err, self.dialogService);
    })

  }

  edit(name: string, id: string) {
    switch (id) {
      case 'minio':
        this.modalService.open('slide-in-form', this.minioForm, name);
        break;
      
      case 'plex':
        this.modalService.open('slide-in-form', this.plexForm, name);
        break;

      case 'nextcloud':
        this.modalService.open('slide-in-form', this.nextCloudForm, name);
        break;

      default:
        this.modalService.open('slide-in-form', this.chartReleaseForm, name);
    }
  }

  delete(name: string) {
    this.translate.get(helptext.charts.delete_dialog.msg).subscribe(msg => {
      this.dialogService.confirm(helptext.charts.delete_dialog.title, msg + name + '?')
      .subscribe(res => {
        if (res) {
          this.dialogRef = this.mdDialog.open(EntityJobComponent, { data: { 'title': (
            helptext.charts.delete_dialog.job) }, disableClose: true});
          this.dialogRef.componentInstance.setCall('chart.release.delete', [name]);
          this.dialogRef.componentInstance.submit();
          this.dialogRef.componentInstance.success.subscribe((res) => {
            this.dialogService.closeAllDialogs();
            this.refreshChartReleases();
          });
          this.dialogRef.componentInstance.failure.subscribe((err) => {
            // new EntityUtils().handleWSError(this, err, this.dialogService);
          })
        }
      })
    })
  }
 }
